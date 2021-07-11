require('../env.js');

const dbConfig = {
  username: process.env.DB_USER,
  password: process.env.DB_PW,
  database: process.env.DB,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: "postgres",
  define: {
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
};

module.exports = {
  development: dbConfig,
  test: dbConfig,
  staging: dbConfig,
  production: dbConfig,
};
