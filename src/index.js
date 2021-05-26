const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');

const logger = require('./logger.js');
const { foundation } = require('./integrations');

app.disable('x-powered-by');
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.raw({ limit: '200MB' }));

// CORS
const origins = ['http://localhost:8080'];
app.use(cors({
  origin: origins,
}));

//===== helpers =====//
function asyncHandler(callback) {
  return (req, res, next) => {
    callback(req, res, next).catch((e) => {
      logger.errorNice(`responding to ${req.url}`, e);
      next(e);
    });
  };
}

const regularRouter = express.Router();

regularRouter.get('/user/:id', asyncHandler(
  async (req, res) => res.json(await foundation.getUser(req.params.id)),
));

regularRouter.get('/user/:user_id/artworks', asyncHandler(
  async (req, res) => res.json(
    await foundation.getArtworks(req.params.user_id, req.params.offset, req.params.limit),
  ),
));

regularRouter.get('/artworks/:artwork_id', asyncHandler(
  async (req, res) => res.json(
    await foundation.getArtwork(req.params.artwork_id),
  ),
));

regularRouter.get('/search', asyncHandler(
  async (req, res) => {
    if (!req.query.q || !req.query.q.length) return res.sendStatus(400);
    res.json(
      await foundation.search(req.query.q, req.query.indexes, req.query.limit),
    );
  },
));

app.use('/', regularRouter);

app.listen(8004, () => console.log('Toll tower is listening on 8004.'));
