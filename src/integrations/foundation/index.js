const axios = require('axios');
const models = require('../../models');
const cheerio = require('cheerio');
const _ = require('lodash');
const ax = {
  hasura: axios.create({ baseURL: 'https://hasura.foundation.app/v1/graphql' }),
  fnd: axios.create({ baseURL: 'https://api.thegraph.com/subgraphs/name/f8n/fnd' }),
  algolia: axios.create({ baseURL: 'https://jr5ltvzcse-1.algolianet.com/1/indexes/*/queries?x-algolia-api-key=1ae2d43a2816a05df9d1e053907048bc&x-algolia-application-id=JR5LTVZCSE' }),
};
const Vibrant = require('node-vibrant');

const utils = require('../../utils');
const assets = require('../../config/assets.json');
const methods = require('./methods.json');
const buildQuery = (methodName, params) => ({
  "query": `query ${methods[methodName]}`,
  "variables": params,
});

const getArtworksFromDB = (id, options) => models.Artworks.findAll({
  ...((id.toLowerCase() !== 'all') && {
    where: {
      creator_id: utils.toChecksumAddress(id),
    },
  }),
  ...{
    include: ['creator'],
    attributes: {exclude: ['creator_id'] },
  },
  ...options,
});

const getUserFromDB = (id) => models.Users.findOne({
  where: {
    id: utils.toChecksumAddress(id),
  },
  include: ['asset'],
});

module.exports = {
  getUser: async (id) => {
    const [user, fetchedUserReq] = await Promise.all([
      getUserFromDB(id),
      ax.hasura.post('', buildQuery(
        'userByPublicKey', { publicKey: utils.toChecksumAddress(id) },
      )),
    ])
    const fetchedUser = _.get(fetchedUserReq, 'data.data.user');
    if (
      !user
      || fetchedUser.username !== user.username
      || fetchedUser.profileImageUrl !== user.profileImageUrl
    ) {
      const address = utils.toChecksumAddress(id);
      const [asset] = await models.Assets.findOrCreate({
        where: { address },
        defaults: { address, ...assets },
      });
      await models.Users.upsert({
        id: utils.toChecksumAddress(id),
        raw: fetchedUser,
        asset_id: asset.id,
      });
    }
    return await getUserFromDB(id);
  },
  getMintedArtworks: async (
    id, offset, limit, statuses,
  ) => {
    const { data } = await ax.fnd.post('', buildQuery('mintedArtworks', {
      moderationStatuses: statuses,
      publicKey: id.toLowerCase(),
      limit,
      offset,
    }));
    return _.get(data, 'data.artworks');
  },
  getArtworkHistory: async (contractId) => {
    const { data } = await ax.fnd.post('', buildQuery('artworkHistory', {
      addressPlusTokenId: contractId,
    }));
    return _.get(data, 'data.nft');
  },
  getArtwork: async (artworkId) => models.Artworks.findOne({
    where: {
      id: artworkId,
    },
    include: ['creator'],
  }),
  getArtworks: async (
    userId,
    offset = 0,
    limit = 48,
    statuses = ["SUSPENDED", "UNDER_REVIEW", "ACTIVE"],
    excludeHidden = false,
  ) => {
    const artworksList = await getArtworksFromDB(userId, {
      offset, limit, order: [['renewed_at', 'DESC']],
    });
    if (userId.toLowerCase() === 'all') return artworksList;
    const [mintedArtworks, creator] = await Promise.all([
      module.exports.getMintedArtworks(userId, offset, limit,  statuses),
      module.exports.getUser(userId),
    ]);
    const targetArtworksToFetch = mintedArtworks.filter((i) => {
      const minted = {
        tokenId: parseInt(i.tokenId, 10),
        ...(i.mostRecentActiveAuction && {
          auctionId: i.mostRecentActiveAuction.auctionId,
          price: i.mostRecentActiveAuction.reservePriceInETH,
        }),
      };
      const storedItem = artworksList.find((j) => j.raw.tokenId === minted.tokenId);
      const stored = storedItem && {
        tokenId: parseInt(storedItem.raw.tokenId, 10),
        ...(storedItem.raw.mostRecentActiveAuction && {
          auctionId: storedItem.raw.mostRecentActiveAuction.auctionId,
          price: storedItem.raw.mostRecentActiveAuction.reservePriceInETH,
        }),
      };
      if (
        storedItem
        && (
          (stored.auctionId === minted.auctionId)
          || (stored.price === minted.price)
        )
      ) return false;
      return true;
    });
    if (!targetArtworksToFetch.length) return artworksList;
    const [tokenIds, artworksHistory] = [
      targetArtworksToFetch.map(
        (i) => parseInt(i.tokenId, 10),
      ),
      await Promise.all(targetArtworksToFetch.map(
        (i) => module.exports.getArtworkHistory(i.id),
      )),
    ];
    const { data } = await ax.hasura.post('', buildQuery('artworksByTokenIds', {
      tokenIds,
      excludeHidden,
      moderationStatuses: statuses,
      userModerationStatuses: statuses,
    }));
    const fetchedArtworks = _.get(data, 'data.artworks');
    const artworksUrl = (await Promise.all(fetchedArtworks.map((i) => {
      const artworkEndpoint = `-${i.tokenId}`;
      return axios.get(`https://foundation.app/@${creator.raw.username}/${artworkEndpoint}`);
    }))).map((i) => {
      const $ = cheerio.load(i.data);
      const preview = $('meta[property="og:image"]').attr('content')
        || $('meta[property="og:image:url"]').attr('content');
      const artwork = $('.fullscreen video, .fullscreen img').attr('src');
      return { preview, artwork };
    });
    const artworksPalette = (await Promise.all(artworksUrl.map(
      (i) => Vibrant.from(i.preview).getPalette(),
    ))).map((i) => _.mapValues(i, (j) => ({
      color: j.getHex(), population: j.population,
    })));
    await Promise.all(_.get(data, 'data.artworks').map((i, k) => {
      const [mintedArtwork, artworkHistory] = [
        targetArtworksToFetch.find((j) => parseInt(j.tokenId, 10) === parseInt(i.tokenId, 10)),
        artworksHistory.find((j) => parseInt(j.tokenId, 10) === parseInt(i.tokenId, 10)),
      ];
      return {
        ...mintedArtwork,
        ...artworkHistory,
        ...i,
        contract: artworkHistory.id,
        preview: artworksUrl[k].preview,
        url: artworksUrl[k].artwork,
        palette: artworksPalette[k],
      };
    }).map((i) => models.Artworks.upsert({
      id: i.id || i.assetId,
      creator_id: utils.toChecksumAddress(userId),
      raw: i,
      renewed_at: (i.mostRecentActiveAuction && new Date(i.mostRecentActiveAuction.dateCreated * 1000)) || new Date(),
      created_at: (i.mostRecentActiveAuction && new Date(i.mostRecentActiveAuction.dateCreated * 1000)) || new Date(),
    })));
    return await getArtworksFromDB(userId, { offset, limit, order: [['renewed_at', 'DESC']] });
  },
  search: async (query, indexes = ['users', 'artworks'], limit = 3) => {
    if (typeof indexes === 'string') indexes = indexes.split(',');
    const [users, artworks] = await Promise.all([
      models.Users.search(query),
      models.Artworks.search(query),
    ]);
    if (users.length || artworks.length) return { users, artworks };
    const { data } = await ax.algolia.post('', {
      requests: indexes.map((indexName) => ({
        indexName,
        params: {
          users: `highlightPreTag=%3Cais-highlight-0000000000%3E&highlightPostTag=%3C%2Fais-highlight-0000000000%3E&hitsPerPage=${limit}&query=${query}&facetFilters=%5B%22moderationStatus%3AACTIVE%22%2C%22isHidden%3Afalse%22%5D&facets=%5B%5D&tagFilters=`,
          artworks: `highlightPreTag=%3Cais-highlight-0000000000%3E&highlightPostTag=%3C%2Fais-highlight-0000000000%3E&hitsPerPage=${limit}&query=${query}&facetFilters=%5B%22moderationStatus%3AACTIVE%22%2C%22isDeleted%3Afalse%22%5D&facets=%5B%5D&tagFilters=`,
        }[indexName],
      })),
    });
   return _.reduce(data.results, (a, i, k) => {
     a[indexes[k]] = i;
     return a;
    }, {});
  },
};
