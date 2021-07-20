const _ = require('lodash');
const { utils } = require('web3');
const { getTime } = require('date-fns');

module.exports = {
  toChecksumAddress: utils.toChecksumAddress,
  getTime,
  cast: {
    artworks: (array) => array.map((i) => ({
      id: i.id,
      url: i.raw.url,
      name: i.raw.name,
      color: i.raw.palette.Vibrant.color,
      preview: i.raw.preview,
      type: i.raw.mimeType.replace(/\/.+$/i, ''),
      lastActivity: {
        type: i.raw.nftHistory[0].event,
        actor: i.raw.nftHistory[0].actorAccount.id,
        amount: (i.raw.nftHistory[0].event.toLowerCase() === 'settled')
          ? i.raw.mostRecentActiveAuction.highestBid.amountInETH
          : i.raw.nftHistory[0].amountInETH,
        date: parseInt(i.raw.nftHistory[0].date, 10),
      },
      creator: {
        id: i.creator.id,
        username: i.creator.raw.username,
        name: i.creator.raw.name,
        profile: i.creator.raw.profileImageUrl,
      },
      description: i.raw.description,
      renewed_at: getTime(i.renewed_at) / 1000,
      is_bold: i.is_bold,
    })),
    artwork: (object) => ({
      id: object.id,
      url: object.raw.url,
      name: object.raw.name,
      color: object.raw.palette.Vibrant.color,
      preview: object.raw.preview,
      contract: object.raw.contract,
      type: object.raw.mimeType.replace(/\/.+$/i, ''),
      history: object.raw.nftHistory.map((j) => ({
        type: j.event,
        actor: j.actorAccount.id,
        amount: (j.event.toLowerCase() === 'settled')
          ? object.raw.mostRecentActiveAuction.highestBid.amountInETH
          : j.amountInETH,
        date: parseInt(j.date, 10),
      })),
      creator: {
        id: object.creator.id,
        username: object.creator.raw.username,
        name: object.creator.raw.name,
        profile: object.creator.raw.profileImageUrl,
      },
      description: object.raw.description,
      renewed_at: getTime(object.renewed_at) / 1000,
      is_bold: object.is_bold,
    }),
    search: (result) => _.mapValues(result, (i, k) => (i.hits || i).map((j) => ({
      id: j.publicKey || j.raw.publicKey,
      name: j.name || j.raw.name,
      username: j.username || j.raw.username,
      profile: j.profileImageUrl || j.raw.profileImageUrl,
    }))),
    user: (object, other = {}) => ({
      id: object.id,
      name: object.raw.name,
      username: object.raw.username,
      profile: object.raw.profileImageUrl,
      ...other,
    }),
  },
};
