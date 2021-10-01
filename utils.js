const User = require("./db/models/User");
const {getAllPrice} = require("./api/axios.js");
const chunk = require("chunk");
require("dotenv").config();
const adminIds = process.env.ADMIN_IDS;

// Проверка является ли текущий пользователь администратором
async function checkAdmin(uid) {
	return adminIds.includes(uid);
}

// Поиск пользователя в БД по id
async function getUserById(uid) {
	const user = await User.findOne({uid});
	return user ? user : null;
}

// Создание пользователя в БД
async function createUser(user) {
	try {
		const uid = user.id;
		const username = user.username;
		const firstname = user.first_name;
		const region = user.language_code;
		return await User.create({
			uid,
			username,
			firstname,
			region,
		});
	} catch (err) {
		console.log("Ошибка при создании пользователя", err);
		return null;
	}
}

// Удаление пользователя из БД по id
function deleteUser(uid) {
	User.deleteOne({uid}, function (err, employee) {
		if (err) {
			console.log("Ошибка при удалении пользователя", err);
			return false;
		}
		return true;
	});
}

// Добавление криптовалюты пользователю
async function userSubscribe(uid, ctx) {
	const user = await getUserById(uid);
	if (user) {
		user.subscribes.push({
			name: ctx.session.name,
			percent: ctx.session.percent,
			interval: ctx.session.interval,
			price: ctx.session.price,
		});
		await user.save().then((data, err) => {
			if (err) console.error(err);
		});
		const formatInterval = minToDHM(ctx.session.interval);
		ctx.replyWithMarkdown(
			`Криптовалюта *${ctx.session.name}* по цене *${ctx.session.price}* добавлена\nПроцент изменения: *${ctx.session.percent}*\nВременной промежуток для информирования: *${formatInterval}*`
		);
	}
}

// Отписка пользователя от криптовалюты
async function userUnsubscribe(uid, currency) {
	const user = await getUserById(uid);
	if (user) {
		await User.updateOne({_id: user._id}, {$pull: {subscribes: {name: currency}}});
		await user.save();
	}
}

// Получение всех пользователей в БД
async function getAllUsers() {
	return await User.find();
}

// "Мои подписки"
async function getMySubscribes(uid) {
	const me = await getUserById(uid);
	if (me?.subscribes.length > 0) return me.subscribes;
	else return null;
}

// Формирование клавиатуры для сцены "Мои подписки"
async function getMySubscribesKeyboard(uid) {
	const meSubscribes = await getMySubscribes(uid);
	let subscribes = [];
	meSubscribes?.forEach((sub) => subscribes.push(sub.name));
	let message = "";
	if (subscribes.length > 0) {
		if (subscribes.length == 9 || subscribes.length == 7 || subscribes.length == 6) subscribes = chunk(subscribes, 3);
		else if (subscribes.length == 10) subscribes = chunk(subscribes, 5);
		else if (subscribes.length == 8) subscribes = chunk(subscribes, 4);
		else subscribes = [subscribes];

		await meSubscribes.forEach((sub, index) => {
			const formatInterval = minToDHM(sub.interval);
			message += `*${index + 1}. ${sub.name}*\nПроцент изменения: _${
				sub.percent
			}_\nИнтервал: _${formatInterval}_\nЦена: _${sub.price}$_\n\n`;
		});

		message += "Для редактирования выберите криптовалюту: ";
	} else {
		message = "У вас еще нет подписок";
	}
	subscribes.push(["Назад"]);
	return {message, subscribes};
}

// Получение строки всех криптовалют пользователей
async function getCurrenciesStr() {
	const allUsers = await getAllUsers();
	let usersSubscribes = [];
	allUsers.forEach((user) => {
		user.subscribes.forEach((sub) => {
			usersSubscribes.push(sub.name);
		});
	});
	let currenciesStr = [...new Set(usersSubscribes)].join(",");
	return {allUsers, currenciesStr};
}

// Таймер
const timer = (ms) => new Promise((res) => setTimeout(res, ms));

// Рассылка сообщений об изменении цены
async function botSendMessage(bot) {
	const {allUsers, currenciesStr} = await getCurrenciesStr();
	getAllPrice(currenciesStr).then((allCur) => {
		allUsers.forEach((user) => {
			if (user.subscribes.length > 0) {
				user.subscribes.forEach(async (sub) => {
					let oldPrice = sub.price;
					let newPrice = allCur[sub.name].USD;
					let percentChange = (((newPrice - oldPrice) / oldPrice) * 100).toFixed(2);
					if (Math.abs(percentChange) >= sub.percent) {
						if (Date.now() - sub.updateTime.getTime() >= sub.interval * 60 * 1000) {
							let message =
								percentChange >= 0
									? `🟢 Криптовалюта ${sub.name} выросла на ${percentChange}%\nСтарая цена: ${oldPrice}$\nНовая цена: ${newPrice}$\n`
									: `🔴 Криптовалюта ${sub.name} упала на ${Math.abs(
											percentChange
									  )}%\nСтарая цена: ${oldPrice}$\nНовая цена: ${newPrice}$`;
							await timer(100);
							bot.telegram
								.sendMessage(user.uid, message)
								.then(() => {
									updateFieldUser(user.uid, sub.name, "price", newPrice);
									updateFieldUser(user.uid, sub.name, "updateTime", Date.now());
								})
								.catch((err) => {
									console.error(err);
									if (err.response.error_code == 403) {
										deleteUser(user.uid);
										console.log(`Пользователь ${user.uid} удален.`);
									}
								});
						}
					}
				});
			}
		});
	});
}

// Обновление поля field криптовалюты currency
async function updateFieldUser(uid, currency, field, value) {
	const user = await getUserById(uid);
	if (user) {
		user.subscribes.find((item) => {
			if (item.name === currency) {
				item[field] = value;
			}
		});
		await user.save().then((data, err) => {
			if (err) console.error(err);
		});
	}
}

// Преобразование минут в дни, часы и минуты
function minToDHM(v) {
	v = Number(v);
	const d = Math.floor(v / 1440);
	const h = Math.floor((v % 1440) / 60);
	const m = Math.floor((v % 1440) % 60);
	const dDisplay = d > 0 ? d + " дн. " : "";
	const hDisplay = h > 0 ? h + " ч. " : "";
	const mDisplay = m > 0 ? m + " мин. " : "";
	return dDisplay + hDisplay + mDisplay;
}

module.exports.getUserById = getUserById;
module.exports.createUser = createUser;
module.exports.deleteUser = deleteUser;
module.exports.userSubscribe = userSubscribe;
module.exports.userUnsubscribe = userUnsubscribe;
module.exports.getMySubscribes = getMySubscribes;
module.exports.getMySubscribesKeyboard = getMySubscribesKeyboard;
module.exports.botSendMessage = botSendMessage;
module.exports.updateFieldUser = updateFieldUser;
module.exports.checkAdmin = checkAdmin;
