const {
	Scenes: {BaseScene},
	Markup,
} = require("telegraf");
const {getCurrency, getTop10} = require("./api/axios.js");
const {
	getUserById,
	createUser,
	userSubscribe,
	userUnsubscribe,
	getMySubscribes,
	getMySubscribesKeyboard,
	updateFieldUser,
	checkAdmin,
} = require("./utils.js");

const moment = require("moment");

const mainScene = new BaseScene("mainScene");
const adminScene = new BaseScene("adminScene");
const subscribeScene = new BaseScene("subscribeScene");
const percentScene = new BaseScene("percentScene");
const intervalScene = new BaseScene("intervalScene");
const mySubscribesScene = new BaseScene("mySubscribesScene");
const updateSubscribeScene = new BaseScene("updateSubscribeScene");
const updatePercentScene = new BaseScene("updatePercentScene");
const updateIntervalScene = new BaseScene("updateIntervalScene");

// Главная сцена
mainScene.enter(async (ctx) => {
	const user = await getUserById(ctx.from.id);
	let mainKeyboard = [["Подписаться", "Мои подписки"]];
	if (user && checkAdmin(user.uid)) {
		mainKeyboard.push(["Панель администратора"]);
	}
	ctx.reply("Выберите команду:", Markup.keyboard(mainKeyboard).oneTime().resize());
});

// Сцена панель администратора
adminScene.enter(async (ctx) => {
	ctx.reply(
		"Для получения информации о пользователе введите команду /get <id> (например: /get 7817283) или перешлите сообщение от пользователя",
		Markup.keyboard(["Отмена"]).oneTime().resize()
	);
});

adminScene.on("message", async (ctx) => {
	let user = null;
	if (ctx.message.hasOwnProperty("text") && !ctx.message.hasOwnProperty("forward_from")) {
		let message = ctx.message.text.trim();
		if (message.toLowerCase() === "отмена") return ctx.scene.enter("mainScene");
		if (message.slice(0, 5) === "/get ") {
			let uid = message.slice(5);
			user = await getUserById(uid);
		}
	} else if (ctx.message.hasOwnProperty("forward_from")) {
		user = await getUserById(ctx.message.forward_from.id);
	} else {
		return ctx.reply("Пользователь скрыл информацию о себе");
	}

	if (user) {
		let subscribesMessage = "";
		user.subscribes.forEach((sub, index) => {
			subscribesMessage += `*${index + 1}. ${sub.name}*\nПроцент изменения: *${sub.percent}*\nИнтервал: *${
				sub.interval
			} мин.*\n\n`;
		});
		const updatedAt = moment(user.updatedAt).format("MM.DD.YYYY hh:mm:ss");
		const createdAt = moment(user.createdAt).format("MM.DD.YYYY hh:mm:ss");
		const username = user.username ? `@${user.username}` : "неизвестно";
		ctx.replyWithMarkdown(
			`Информация о пользователе *#${user.uid}:*\nИмя: *${user.firstname}*\nНикнейм: *${username}*\nРегион: *${
				user.region
			}*\nПервое посещение: *${createdAt}*\nПоследняя активность: *${updatedAt}*\n\nАктивные подписки: \n${
				subscribesMessage ? subscribesMessage : "отсутствуют"
			}`
		);
	} else {
		ctx.reply("Информация не доступна либо неверно введена команда");
	}
});

// Сцена "Мои подписки"
mySubscribesScene.enter((ctx) => {
	getMySubscribesKeyboard(ctx.message.from.id).then((res) => {
		ctx.replyWithMarkdown(res.message, Markup.keyboard(res.subscribes).oneTime().resize());
	});
});

mySubscribesScene.on("text", async (ctx) => {
	getMySubscribes(ctx.message.from.id).then((mySub) => {
		let userInput = ctx.message.text.trim().toUpperCase();
		if (mySub != null && userInput != "НАЗАД") {
			if (mySub.some((e) => e.name === userInput)) {
				ctx.session.selectSubscribe = userInput;
				ctx.scene.enter("updateSubscribeScene");
			} else {
				ctx.reply("У вас нет подписки на такую криптовалюту.").then(() => ctx.scene.enter("mySubscribesScene"));
			}
		} else {
			return ctx.scene.enter("mainScene");
		}
	});
});

// Сцена редактирования криптовалют
updateSubscribeScene.enter((ctx) => {
	ctx.reply(
		`Редактирование ${ctx.session.selectSubscribe}\nВыберите действие:`,
		Markup.keyboard([["Изменить процент", "Изменить интервал", "Отписаться"], ["Назад"]])
			.oneTime()
			.resize()
	);
});

updateSubscribeScene.on("text", async (ctx) => {
	switch (ctx.message.text) {
		case "Изменить процент":
			ctx.scene.enter("updatePercentScene");
			break;
		case "Изменить интервал":
			ctx.scene.enter("updateIntervalScene");
			break;
		case "Отписаться":
			await userUnsubscribe(ctx.message.from.id, ctx.session.selectSubscribe);
			ctx.scene.enter("mySubscribesScene");
			break;
		default:
			ctx.scene.enter("mySubscribesScene");
			break;
	}
});

// Сцена редактирования процента
updatePercentScene.enter((ctx) => {
	ctx.reply("Введите новое значение процента:", Markup.keyboard(["Отмена"]).oneTime().resize());
});

updatePercentScene.on("text", async (ctx) => {
	ctx.session.percent = parseFloat(ctx.message.text);
	if (ctx.message.text.toLowerCase() === "отмена") return ctx.scene.enter("updateSubscribeScene");
	if (Number.isNaN(ctx.session.percent) || ctx.session.percent < 0) {
		ctx.reply(`Ошибка! Некорректное значение.`).then(() => ctx.scene.enter("updatePercentScene"));
	} else {
		await updateFieldUser(ctx.message.from.id, ctx.session.selectSubscribe, "percent", ctx.session.percent);
		return ctx.scene.enter("mySubscribesScene");
	}
});

// Сцена редактирования интервала
updateIntervalScene.enter((ctx) => {
	ctx.reply(
		"Введите новое значение временного промежутка:",
		Markup.keyboard([["5 минут", "10 минут", "1 час", "1 день"], ["Отмена"]])
			.oneTime()
			.resize()
	);
});

updateIntervalScene.on("text", async (ctx) => {
	if (ctx.message.text.toLowerCase() === "отмена") return ctx.scene.enter("updateSubscribeScene");
	switch (ctx.message.text) {
		case "5 минут":
			ctx.session.interval = 5;
			break;
		case "10 минут":
			ctx.session.interval = 10;
			break;
		case "1 час":
			ctx.session.interval = 60;
			break;
		case "1 день":
			ctx.session.interval = 1440;
			break;
		default:
			ctx.session.interval = parseInt(ctx.message.text);
			break;
	}
	if (Number.isNaN(ctx.session.interval) || ctx.session.interval <= 0) {
		ctx.reply(`Ошибка! Некорректное значение.`).then(() => ctx.scene.enter("updateIntervalScene"));
	} else {
		await updateFieldUser(ctx.message.from.id, ctx.session.selectSubscribe, "interval", ctx.session.interval);
		return ctx.scene.enter("mySubscribesScene");
	}
});

// Сцена добавления криптовалюты
subscribeScene.enter((ctx) => {
	getTop10().then((res) => {
		ctx.reply("Введите тикер криптовалюты (например BTC, ETH и т.д.):", Markup.keyboard(res).oneTime().resize());
	});
});

subscribeScene.on("text", (ctx) => {
	if (ctx.message.text.toLowerCase() === "отмена") return ctx.scene.enter("mainScene");
	ctx.session.name = ctx.message.text.trim().toUpperCase();
	getCurrency(ctx.session.name)
		.then(async (res) => {
			ctx.session.price = res;
			let currentUser = ctx.message.from;
			const user = await getUserById(currentUser.id);
			if (user) {
				if (user.subscribes.length < 10) {
					if (user.subscribes.find((sub) => sub.name === ctx.session.name)) {
						ctx
							.reply(`Ошибка! Криптовалюта с тикером ${ctx.session.name} уже добавлена.`)
							.then(() => ctx.scene.enter("subscribeScene"));
					} else {
						return ctx.scene.enter("percentScene");
					}
				} else {
					ctx.reply(`Ошибка! Вы уже подписаны на 10 криптовалют.`).then(() => ctx.scene.enter("mainScene"));
				}
			} else {
				const newUser = await createUser(currentUser);
				if (newUser) {
					return ctx.scene.enter("percentScene");
				}
			}
		})
		.catch((err) => {
			ctx
				.reply(`Ошибка! Криптовалюты с тикером ${ctx.session.name} не существует.`)
				.then(() => ctx.scene.enter("subscribeScene"));
		});
});

// Сцена добавления процента изменения
percentScene.enter((ctx) =>
	ctx.reply(
		`Введите процент изменения для криптовалюты с тикером ${ctx.session.name} (например 0.05):`,
		Markup.keyboard(["Отмена"]).oneTime().resize()
	)
);
percentScene.on("text", (ctx) => {
	if (ctx.message.text.toLowerCase() === "отмена") return ctx.scene.enter("mainScene");
	ctx.session.percent = parseFloat(ctx.message.text);
	if (Number.isNaN(ctx.session.percent) || ctx.session.percent < 0) {
		ctx.reply(`Ошибка! Некорректное значение.`).then(() => ctx.scene.enter("percentScene"));
	} else {
		return ctx.scene.enter("intervalScene");
	}
});

// Сцена добавления временного промежутка для информирования
intervalScene.enter(async (ctx) => {
	ctx.session.intervalComplete = false;
	await ctx.reply(
		"Введите временной промежуток в минутах для информирования (например 5):",
		Markup.inlineKeyboard([
			Markup.button.callback("5 минут", "5m"),
			Markup.button.callback("10 минут", "10m"),
			Markup.button.callback("1 час", "60m"),
			Markup.button.callback("1 день", "1440m"),
		])
	);
});

intervalScene.on("text", async (ctx) => {
	if (ctx.message.text.toLowerCase() === "отмена") {
		ctx.session.intervalComplete = true;
		return ctx.scene.enter("mainScene");
	}
	ctx.session.interval = parseInt(ctx.message.text);
	if (Number.isNaN(ctx.session.interval) || ctx.session.interval <= 0) {
		ctx.reply(`Ошибка! Некорректное значение.`).then(() => ctx.scene.enter("intervalScene"));
	} else {
		ctx.session.intervalComplete = true;
		await userSubscribe(ctx.message.from.id, ctx);
		return ctx.scene.enter("mainScene");
	}
});

module.exports.mainScene = mainScene;
module.exports.adminScene = adminScene;
module.exports.subscribeScene = subscribeScene;
module.exports.intervalScene = intervalScene;
module.exports.percentScene = percentScene;
module.exports.mySubscribesScene = mySubscribesScene;
module.exports.updateSubscribeScene = updateSubscribeScene;
module.exports.updatePercentScene = updatePercentScene;
module.exports.updateIntervalScene = updateIntervalScene;
