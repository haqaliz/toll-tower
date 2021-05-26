const axios = require('axios');
const { utils } = require('Web3');
const models = require('../../models');
const cheerio = require('cheerio');
const _ = require('lodash');
const ax = {
  hasura: axios.create({ baseURL: 'https://hasura.foundation.app/v1/graphql' }),
  fnd: axios.create({ baseURL: 'https://api.thegraph.com/subgraphs/name/f8n/fnd' }),
  algolia: axios.create({ baseURL: 'https://jr5ltvzcse-1.algolianet.com/1/indexes/*/queries?x-algolia-api-key=1ae2d43a2816a05df9d1e053907048bc&x-algolia-application-id=JR5LTVZCSE' }),
};
const Vibrant = require('node-vibrant');

const methods = require('./methods.json');
const buildQuery = (methodName, params) => ({
  "query": `query ${methods[methodName]}`,
  "variables": params,
});

const getArtworksFromDB = (id, options) => models.Artworks.findAll({
  ...((id.toLowerCase() !== 'all') && {
    where: {
      address: utils.toChecksumAddress(id),
    },
  }),
  ...options,
});

module.exports = {
  getUser: async (id) => {
    const { data } = await ax.hasura.post('', buildQuery(
      'userByPublicKey', { publicKey: utils.toChecksumAddress(id) },
    ));
    return _.get(data, 'data.user');
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
  
  getArtwork: async (artworkId) => models.Artworks.findByPk(artworkId),
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
    const mintedArtworks = await module.exports.getMintedArtworks(userId, offset, limit,  statuses);
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
        && ((stored.auctionId === minted.auctionId)
        || (stored.price === minted.price))
      ) return false;
      return true;
    });
    if (!targetArtworksToFetch.length) return artworksList;
    const tokenIds = targetArtworksToFetch.map(
      (i) => parseInt(i.tokenId, 10),
    );
    const { data } = await ax.hasura.post('', buildQuery('artworksByTokenIds', {
      tokenIds,
      excludeHidden,
      moderationStatuses: statuses,
      userModerationStatuses: statuses,
    }));
    const fetchedArtworks = _.get(data, 'data.artworks');
    const artworksUrl = (await Promise.all(fetchedArtworks.map((i) => {
      const artworkEndpoint = `-${i.tokenId}`;
      return axios.get(`https://foundation.app/@${i.creator.username}/${artworkEndpoint}`);
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
      const mintedArtwork = targetArtworksToFetch.find((j) => parseInt(j.tokenId, 10) === parseInt(i.tokenId, 10));
      return {
        ...mintedArtwork,
        ...i,
        preview: artworksUrl[k].preview,
        url: artworksUrl[k].artwork,
        palette: artworksPalette[k],
      };
    }).map((i) => models.Artworks.upsert({
      id: i.id || i.assetId,
      address: utils.toChecksumAddress(userId),
      raw: i,
      renewed_at: (i.mostRecentActiveAuction && new Date(i.mostRecentActiveAuction.dateCreated * 1000)) || new Date(),
      created_at: (i.mostRecentActiveAuction && new Date(i.mostRecentActiveAuction.dateCreated * 1000)) || new Date(),
    })));
    return await getArtworksFromDB(userId, { offset, limit, order: [['renewed_at', 'DESC']] });
  },
  search: async(query, indexes = ['users', 'artworks'], limit = 3) => {
    if (typeof indexes === 'string') indexes = indexes.split(',');
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
