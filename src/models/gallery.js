import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class gallery extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id_gallery: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    thumbnail: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    }
  }, {
    sequelize,
    tableName: 'gallery',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id_gallery" },
        ]
      },
    ]
  });
  }
}
