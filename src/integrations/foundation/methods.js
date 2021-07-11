module.exports = {
	userByPublicKey: "hasuraUserByPublicKey($publicKey: String!) {  user: user_by_pk(publicKey: $publicKey) {    ...HasuraUserFragment  }}fragment HasuraUserFragment on user {  ...HasuraUserFragmentLight  firstName  lastName  isAdmin  links}fragment HasuraUserFragmentLight on user {  userIndex  publicKey  username  profileImageUrl  coverImageUrl  name  bio  isApprovedCreator  moderationStatus  joinedWaitlistAt  createdAt}",
	mintedArtworks: "getMintedArtworks($publicKey: String!, $limit: Int!, $offset: Int!) {  artworks: nfts(    where: {creator: $publicKey, owner_not: \"0x0000000000000000000000000000000000000000\"}    first: $limit    skip: $offset    orderBy: dateMinted    orderDirection: desc  ) {    ...NftFragment  }}fragment NftFragment on Nft {  ...NftBaseFragment  ...NftOwnershipFragment  nftHistory(orderBy: date, orderDirection: desc, first: 1) {    event  }  mostRecentActiveAuction {    ...AuctionFragment    highestBid {      ...BidFragment    }  }}fragment NftBaseFragment on Nft {  id  tokenId  dateMinted}fragment NftOwnershipFragment on Nft {  ownedOrListedBy {    id  }  creator {    id  }}fragment AuctionFragment on NftMarketAuction {  id  auctionId  duration  status  reservePriceInETH  seller {    id  }  dateEnding  dateStarted  dateCreated  transactionHashCreated}fragment BidFragment on NftMarketBid {  amountInETH  status  datePlaced  bidder {    id  }}",
	artworksByTokenIds: "hasuraArtworksByTokenIds($tokenIds: [Int!]!, $excludeHidden: Boolean!, $moderationStatuses: [artwork_moderationstatus_enum!], $userModerationStatuses: [user_moderationstatus_enum!]) {  artworks: artwork(    where: {tokenId: {_in: $tokenIds}, deletedAt: {_is_null: true}, moderationStatus: {_in: $moderationStatuses}, user: {moderationStatus: {_in: $userModerationStatuses}}, _or: [{_and: [{hiddenAt: {_is_null: true}}, {user: {hiddenAt: {_is_null: true}}}]}, {_or: [{_and: [{hiddenAt: {_is_null: $excludeHidden}}, {user: {hiddenAt: {_is_null: true}}}]}, {_and: [{hiddenAt: {_is_null: true}}, {user: {hiddenAt: {_is_null: $excludeHidden}}}]}, {_and: [{hiddenAt: {_is_null: $excludeHidden}}, {user: {hiddenAt: {_is_null: $excludeHidden}}}]}]}]}  ) {    ...HasuraArtworkFragment  }}fragment HasuraArtworkFragment on artwork {  id  name  description  assetIPFSPath  metadataIPFSPath  width  height  duration  mimeType  mintTxHash  assetId  assetStatus  mintTxHash  tokenId  status  hiddenAt  deletedAt  moderationStatus  latestTxDate}fragment HasuraUserFragment on user {  ...HasuraUserFragmentLight  firstName  lastName  isAdmin  links}fragment HasuraUserFragmentLight on user {  userIndex  publicKey  username  profileImageUrl  coverImageUrl  name  bio  isApprovedCreator  moderationStatus  joinedWaitlistAt  createdAt}",
	artworkHistory: "getArtworkHistory($addressPlusTokenId: String!) {  nft(id: $addressPlusTokenId) {    ...NftWithHistoryFragment  }}fragment NftWithHistoryFragment on Nft {  ...NftBaseFragment  ...NftOwnershipFragment  mostRecentActiveAuction {    ...AuctionFragment    bids(orderBy: amountInETH, orderDirection: desc) {      ...BidFragment    }    highestBid {      ...BidFragment    }  }  nftHistory(orderBy: date, orderDirection: desc) {    ...NftHistoryFragment  }}fragment NftBaseFragment on Nft {  id  tokenId  dateMinted}fragment NftOwnershipFragment on Nft {  ownedOrListedBy {    id  }}fragment AuctionFragment on NftMarketAuction {  id  auctionId  duration  status  reservePriceInETH  seller {    id  }  dateEnding  dateStarted  dateCreated  transactionHashCreated}fragment BidFragment on NftMarketBid {  amountInETH  status  datePlaced  bidder {    id  }}fragment NftHistoryFragment on NftHistory {  id  event  date  marketplace  transactionHash  amountInETH  actorAccount {    id  }  nftRecipient {    id  }}"
};
