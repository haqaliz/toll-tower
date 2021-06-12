module.exports = {
  up: async (queryInterface, Sequelize) => {
    await Promise.all([
      queryInterface.createTable('assets', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        address: {
          allowNull: false,
          type: Sequelize.STRING,
        },
        preferences: {
          type: Sequelize.INTEGER,
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      }),
      queryInterface.addColumn('users', 'asset_id', Sequelize.INTEGER),
    ]);
    await queryInterface.addIndex('assets', ['address']);
  },
  down: async (queryInterface, Sequelize) => {
    await Promise.all([
      queryInterface.dropTable('assets'),
      queryInterface.removeColumn('users', 'asset_id'),
    ]);
  }
};
