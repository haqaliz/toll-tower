module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('transactions_history', {
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
      contract: {
        allowNull: false,
        type: Sequelize.STRING
      },
      content: {
        allowNull: false,
        type: Sequelize.JSONB
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
    });
    await queryInterface.addIndex('transactions_history', ['address']);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('transactions_history');
  }
};
