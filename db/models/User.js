const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
	{
		uid: {
			type: String,
			required: true,
		},
		username: {
			type: String,
			required: false,
			trim: true,
		},
		firstname: {
			type: String,
			required: true,
			trim: true,
		},
		region: {
			type: String,
			required: true,
			trim: true,
		},
		subscribes: [
			{
				name: {
					type: String,
					trim: true,
				},
				percent: {
					type: Number,
					trim: true,
				},
				interval: {
					type: Number,
					trim: true,
				},
				price: {
					type: Number,
					trim: true,
				},
				updateTime: {
					type: Date,
					default: Date.now,
				},
			},
		],
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model("User", userSchema);
