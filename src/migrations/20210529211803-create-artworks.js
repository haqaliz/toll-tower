module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('artworks', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING,
      },
      address: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      raw: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      renewed_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('artworks');
  },
};
