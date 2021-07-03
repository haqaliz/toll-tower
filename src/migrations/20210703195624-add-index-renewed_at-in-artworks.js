module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('artworks', ['renewed_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('artworks', ['renewed_at']);
  }
};
