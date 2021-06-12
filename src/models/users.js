const { Model } = require('sequelize');
const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Users extends Model {
    static search(query) {
      return Users.findAll({
        where: {
          [Op.or]: [
            { "raw.username": { [Op.iLike]: `%${query}%` } },
            { "raw.name": { [Op.iLike]: `%${query}%` } },
            { "raw.bio": { [Op.iLike]: `%${query}%` } },
          ],
        },
      });
    }

    static associate(models) {
      Users.hasOne(models.Assets, { foreignKey: 'address', as: 'asset' });
    }
  };
  Users.init({
    raw: DataTypes.JSONB,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Users',
    tableName: 'users',
  });
  return Users;
};
