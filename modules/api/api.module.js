import bodyParser from 'body-parser';
/** @type AppConfig */
import config from 'config';
import connectMongo from 'connect-mongo';
import express from 'express';
import session from 'express-session';
import { getLogger } from 'log4js';
import mongoose from 'mongoose';
import passport from 'passport';
import { inspect } from 'util';

import { COOKIES_LIFETIME, STATUS_CODE } from './api.constants';
import * as AuthController from './controllers/auth.controller';
import RestError from './errors/rest.error';

const MongoStore = connectMongo(session);
const logger = getLogger('api.module');
passport.serializeUser((user, done) => done(null, user._id.toString()));
passport.deserializeUser((userId, done) => done(null, userId));
const { OK, INTERNAL_SERVER_ERROR } = STATUS_CODE;

let app;
let server;

export async function init() {
	logger.trace('start API-module initializing');
	const sessionStore = new MongoStore({ mongooseConnection: mongoose.connection });
	app = express();
	app.use(bodyParser.urlencoded({ extended: true }));
	app.use(bodyParser.json());
	app.use(session({
		name: 'crypto.sid',
		secret: config.api.session_secret,
		cookie: { maxAge: COOKIES_LIFETIME },
		resave: false,
		saveUninitialized: false,
		rolling: true,
		store: sessionStore,
	}));
	app.use(passport.initialize({}));
	app.use(passport.session({}));
	await new Promise((resolve) => {
		server = app.listen(config.api.port, () => resolve());
	});
	app.get('/api/hello', (req, res) => res.status(OK).json({ result: 'hello!', status: OK }));
	[AuthController].forEach(({ init }) => init());
	logger.info('API-module has been started');
}

/**
 * @param {'get'|'post'} method
 * @param {String} route
 * @param {function(req?)?} validator
 * @param {function({ form:Object, user:UserDocument?, req }):Promise.<*>} handler
 */
export function addRestHandler(method, route, validator, handler) {
	if (!handler) {
		// noinspection JSValidateTypes
		handler = validator;
		validator = () => ({});
	}
	app[method](route, async (req, res) => {
		try {
			const form = validator(req);
			const result = await handler({ form, req, user: req.user });
			logger.trace(`${method.toUpperCase()} ${route} ${inspect(form, { compact: true })}`);
			res.status(OK).json({ result: result || true, status: OK });
		} catch (error) {
			if (error instanceof RestError) {
				return res.status(error.status).json({ error: error.data, status: error.status });
			}
			logger.trace(`${method.toUpperCase()} ${route}\n${inspect({
				query: req.query,
				body: req.body,
				params: req.params,
			}, false, null, true)}`);
			logger.error(error);
			return res.status(INTERNAL_SERVER_ERROR).json('server side error');
		}
	});
}
