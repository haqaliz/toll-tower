const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Artworks extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  Artworks.init({
    address: DataTypes.STRING,
    raw: DataTypes.JSONB,
    renewed_at: DataTypes.DATE,
    created_at: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Artworks',
    tableName: 'artworks',
    timestamps: false,
  });
  return Artworks;
};
