const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const connectSessionSequelize = require('connect-session-sequelize');
const session = require('express-session');
const _ = require('lodash');

const models = require('./models');
const utils = require('./utils.js');
const logger = require('./logger.js');
const { foundation, price } = require('./integrations');

// CORS
const origins = ['http://localhost:8080'];

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

// SESSION
const SequelizeStore = connectSessionSequelize(session.Store);
const store = new SequelizeStore({ db: models.sequelize });
store.sync();
app.use(session({
  name: 'x-auth',
  secret: 'QeOtLqfzR8Su$',
  store,
  cookie: {
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'none',
    httpOnly: false,
    secure: ['staging', 'production'].includes(process.env.NODE_ENV),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
  resave: false,
  saveUninitialized: false,
}));

app.disable('x-powered-by');
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.raw({ limit: '200MB' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(cors({
  origin: origins,
  credentials: true,
}));

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

regularRouter.get('/search', asyncHandler(
  async (req, res) => {
    if (!req.query.q || !req.query.q.length) return res.sendStatus(400);
    res.send(utils.cast.search(
      await foundation.search(req.query.q, req.query.indexes, req.query.limit),
    ));
  },
));

regularRouter.get('/price', asyncHandler(
  async (req, res) => res.send(await price.get(req.query.currency)),
));

app.use('/auth', authRouter);
app.use('/', regularRouter);

app.listen(8004, () => console.log('Toll tower is listening on 8004.'));
