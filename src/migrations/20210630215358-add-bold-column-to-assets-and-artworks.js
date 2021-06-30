module.exports = {
  up: async (queryInterface, Sequelize) => {
    await Promise.all([
      queryInterface.addColumn('assets', 'bold', Sequelize.INTEGER),
      queryInterface.addColumn('artworks', 'is_bold', Sequelize.BOOLEAN),
    ]);
    await queryInterface.sequelize.query('UPDATE assets SET bold = 5 WHERE bold IS NULL;');
  },
  down: async (queryInterface) => {
    await Promise.all([
      await queryInterface.removeColumn('assets', 'bold'),
      await queryInterface.removeColumn('artworks', 'is_bold'),
    ]);
  },
};
