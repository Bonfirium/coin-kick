import mongoose from 'mongoose';

export default mongoose.model('blog_news', new mongoose.Schema({
	project: { type: mongoose.Schema.Types.ObjectId, ref: 'blog_project', required: true },
	rating: { type: Number, default: 0 },
	text: { type: String, required: true },
}, { timestamp: true }));

/**
 * @typedef {Object} UserDocument
 * @property {String} project
 * @property {String} text
 */
