const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const connectSessionSequelize = require('connect-session-sequelize');
const session = require('express-session');
const _ = require('lodash');
const geoip = require('geoip-lite');

const models = require('./models');
const utils = require('./utils.js');
const logger = require('./logger.js');
const { foundation, price } = require('./integrations');

const config = require('./config');

app.disable('x-powered-by');

// HELPERS
function asyncHandler(callback) {
  return (req, res, next) => {
    callback(req, res, next).catch((e) => {
      logger.errorNice(`responding to ${req.url}`, e);
      next(e);
    });
  };
}

// PASSPORT
passport.use(new LocalStrategy(
  { usernameField: 'id', },
  async (id, _password, done) => {
    try {
      const user = await foundation.getUser(id);
      if (!user) {
        return done(null, false, { message: 'Incorrect user.' });
      }
      return done(null, user);
    } catch (e) {
      return done(e);
    }
  },
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await foundation.getUser(id);
    done(null, user);
  } catch (e) {
    done(e);
  }
});

// STATIC
app.use(express.static('static'));

// SESSION
const SequelizeStore = connectSessionSequelize(session.Store);
const store = new SequelizeStore({ db: models.sequelize });
store.sync();
app.use(session({
  name: 'bloomo-auth',
  secret: process.env.SESSION_SECRET,
  store,
  cookie: {
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'none',
    httpOnly: false,
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
  resave: false,
  saveUninitialized: false,
}));

// JSON
app.use(bodyParser.json());

// PASSPORT
app.use(passport.initialize());
app.use(passport.session());

// CORS
const origins = [];
if (process.env.NODE_ENV !== 'production') origins.push('http://localhost:8080');
else {
  origins.push('https://bloomo.app');
}
app.use(cors({
  origin: origins,
  credentials: true,
}));

// NO CACHING
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// RAW
app.use(express.raw({ limit: '200MB' }));

// AUTH ROUTES
const authRouter = express.Router();

authRouter.post(
  '/',
  (req, res, next) => {
    req.body.id = utils.toChecksumAddress(req.body.id);
    req.body.password = req.body.id;
    next();
  },
  passport.authenticate('local'),
  (req, res) => res.sendStatus(200),
);

authRouter.post(
  '/logout',
  (req, res) => {
    req.logout();
    res.setHeader('content-type', 'text/plain');
    res.status(200).clearCookie('x-auth').send('OK');
  },
);

// REGULAR ROUTES
const regularRouter = express.Router();

regularRouter.get('/user/current', asyncHandler(async (req, res) => {
  if (!req.user) return res.sendStatus(400);
  res.send(utils.cast.user(req.user, {
    bio: req.user.raw.bio,
    links: _.map(req.user.raw.links).filter((i) => i.handle),
    assets: {
      preferences: req.user.asset.preferences,
      bold: req.user.asset.bold,
    },
  }));
}));

regularRouter.get('/user/artworks', asyncHandler(async (req, res) => {
  if (!req.user) return res.sendStatus(400);
  res.send(utils.cast.artworks(await foundation.getArtworks(
    req.user.id, req.params.offset, req.params.limit,
  )));
}));

regularRouter.put('/user/assets', asyncHandler(async (req, res) => {
  if (!req.user) return res.sendStatus(400);
  const transaction = await models.TransactionsHistory.create({
    address: req.user.id,
    contract: req.body.contract,
    content: req.body.content,
    created_at: new Date(),
  });
  _.forEach(transaction.content, (i, k) => {
    if (req.user.asset[k]) req.user.asset[k] += i.quantity;
  });
  req.user.asset.save();
  res.sendStatus(200);
}));

regularRouter.post('/user/artwork/:artwork_id/power-up', asyncHandler(async (req, res) => {
  if (!req.user) return res.sendStatus(400);
  const artwork = await models.Artworks.findOne({
    where: {
      id: req.params.artwork_id,
    },
    include: [
      {
        association: 'creator',
        include: ['asset'],
      },
    ],
  });
  const powerUps = _.keys(req.body);
  if (
    !powerUps.some((i) => _.keys(config.assets).includes(i))
    || (
      powerUps.includes('preferences')
      && (Date.now() - (utils.getTime(artwork.renewed_at) / 1000) < (2 * 60))
    )
  ) return res.sendStatus(400);
  if (!artwork.is_bold && powerUps.includes('bold')) {
    artwork.creator.asset.bold -= 1;
    artwork.is_bold = true;
  }
  if (powerUps.includes('preferences')) {
    artwork.creator.asset.preferences -= 1;
    artwork.renewed_at = new Date();
  }
  artwork.creator.asset.save();
  artwork.save();
  res.sendStatus(200);
}));


regularRouter.get('/user/:user_id/detail', asyncHandler(
  async (req, res) => res.send(
    utils.cast.user(await foundation.getUser(req.params.user_id)),
  ),
));

regularRouter.get('/user/:user_id/artworks', asyncHandler(async (req, res) => res.send(
  utils.cast.artworks(await foundation.getArtworks(
    req.params.user_id, req.params.offset, req.params.limit,
  )),
)));

regularRouter.get('/artworks/:artwork_id', asyncHandler(async (req, res) => res.send(
  utils.cast.artwork(await foundation.getArtwork(req.params.artwork_id)),
)));

regularRouter.get('/search', asyncHandler(async (req, res) => {
  if (!req.query.q || !req.query.q.length) return res.sendStatus(400);
  res.send(utils.cast.search(
    await foundation.search(req.query.q, req.query.indexes, req.query.limit),
  ));
}));

regularRouter.get('/user/:user_id/states', asyncHandler(async (req, res) => res.send(
  await foundation.getUserStates(req.params.user_id),
)));

regularRouter.get('/user/:user_id/follows', asyncHandler(async (req, res) => res.send(
  await foundation.getUserFollowers(req.params.user_id, req.query.offset, req.query.limit),
)));

regularRouter.post('/analysis/:type/:id', asyncHandler(
  async (req, res) => {
    if (!req.body.duration) res.sendStatus(400);
    const ip = (process.env.NODE_ENV === 'production') ? (
      req.headers['x-forwarded-for']
      || req.connection.remoteAddress
    ) : "207.97.227.239";
    await models.Analysis.create({
      ...(req.user && {
        user_id: req.user.id,
      }),
      ip_address: ip,
      geo: geoip.lookup(ip),
      target_type: req.params.type,
      target_id: req.params.id,
      duration: req.body.duration,
      ...(req.body.targets && {
        targets: req.body.targets,
      }),
      created_at: new Date(),
    });
    res.sendStatus(200);
  },
));

regularRouter.get('/price', asyncHandler(
  async (req, res) => res.send(await price.get(req.query.currency)),
));

app.use('/auth', authRouter);
app.use('/', regularRouter);

app.use((req, res, next) => res.sendfile('/static/index.html', { root: __dirname + '/..' }));

app.listen(8004, () => console.log('Toll tower is listening on 8004.'));
