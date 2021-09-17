const mongoose = require("mongoose");
module.exports = {
	connect: async (DB_HOST) => {
		try {
			await mongoose.connect(DB_HOST, {
				useNewUrlParser: true,
				useUnifiedTopology: true,
			});
		} catch (err) {
			console.log("MongoDB connection error.", err);
			process.exit();
		}
	},

	close: () => {
		mongoose.connection.close();
	},
};
