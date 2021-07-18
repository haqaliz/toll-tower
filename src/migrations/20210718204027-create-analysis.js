module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('analysis', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_id: {
        type: Sequelize.STRING,
      },
      ip_address: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      target_type: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      target_id: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      duration: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      targets: {
        type: Sequelize.JSONB,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('analysis');
  }
};
