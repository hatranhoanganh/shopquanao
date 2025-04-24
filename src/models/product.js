import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class product extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id_product: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_category: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'category',
        key: 'id_category'
      }
    },
    id_gallery: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'gallery',
        key: 'id_gallery'
      }
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    discount: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    size: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'product',
    timestamps: true,
    createdAt: 'created_at', 
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id_product" },
        ]
      },
      {
        name: "FK_PRODUCT_CATEGORY",
        using: "BTREE",
        fields: [
          { name: "id_category" },
        ]
      },
      {
        name: "FK_PRODUCT_GALLERY",
        using: "BTREE",
        fields: [
          { name: "id_gallery" },
        ]
      },
    ]
  });
  }
}
