const {
	Telegraf,
	session,
	Scenes: {Stage},
} = require("telegraf");
const TelegrafLogger = require("telegraf-logger");
const {
	mainScene,
	adminScene,
	subscribeScene,
	intervalScene,
	percentScene,
	mySubscribesScene,
	updateSubscribeScene,
	updatePercentScene,
	updateIntervalScene,
} = require("./scenes.js");
const db = require("./db/connection.js");
const {userSubscribe, createUser, deleteUser, botSendMessage, checkAdmin} = require("./utils.js");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const stage = new Stage([
	subscribeScene,
	intervalScene,
	percentScene,
	mainScene,
	adminScene,
	mySubscribesScene,
	updateSubscribeScene,
	updatePercentScene,
	updateIntervalScene,
]);

// middleware admin
const acl = async (ctx, next) => {
	if (!checkAdmin(ctx.from.id)) {
		return ctx.reply("Доступ запрещен!");
	}
	return next(ctx);
};

// Подключение к БД
db.connect(process.env.MONGO_CONNECT).then(() => {
	console.log("Connected to mongoose...");
	bot.launch().then(() => {
		console.log("Start bot");
	});
});
const logger = new TelegrafLogger({
	log: console.log,
	format: "%ut => @%u %fn %ln (%fi): <%ust> %c",
	contentLength: 100,
});
bot.use(logger.middleware());
bot.use(session());
bot.use(stage.middleware());

const interval = setInterval(() => {
	botSendMessage(bot);
}, 1000 * 10);

bot.action(/\d+/, async (ctx) => {
	ctx.editMessageText(ctx.callbackQuery.message.text, ctx.callbackQuery.message.message_id, {
		reply_markup: {remove_keyboard: true},
	});
	if (!ctx.session.intervalComplete) {
		ctx.session.interval = ctx.match[0];
		await userSubscribe(ctx.from.id, ctx);
		ctx.scene.enter("mainScene");
		ctx.answerCbQuery();
	}
	ctx.session.intervalComplete = false;
});

// Команды бота
bot.command("subscribe", (ctx) => ctx.scene.enter("subscribeScene"));
bot.command("mysubscribe", (ctx) => ctx.scene.enter("mySubscribesScene"));

bot.command("main", (ctx) => ctx.scene.enter("mainScene"));
bot.command("admin", acl, (ctx) => ctx.scene.enter("adminScene"));
bot.command("help", (ctx) =>
	ctx.reply(
		'/subscribe\nДля подписки на криптовалюту нажмите кнопку "Подписаться" и пошагово введите необходимые параметры. \n\n/mysubscribe\nДля просмотра своих криптовалют нажмите кнопку "Мои подписки", где можно отредактировать или удалить криптовалюту. \n\n/admin\nУ администратора имеется возможность перейти в "Панель администратора", где можно посмотреть подписки выбранного пользователя.\n\n/main\nКоманда для возврата в главное меню.'
	)
);

// Команды меню
bot.hears("Подписаться", (ctx) => ctx.scene.enter("subscribeScene"));
bot.hears("Мои подписки", (ctx) => ctx.scene.enter("mySubscribesScene"));
bot.hears("Назад", (ctx) => ctx.scene.enter("mainScene"));
bot.hears("Панель администратора", acl, (ctx) => ctx.scene.enter("adminScene"));

bot.start(async (ctx) => {
	ctx.reply("Добро пожаловать в программу отслеживания изменений криптовалют!");
	let currentUser = ctx.message.from;
	await deleteUser(currentUser.id);
	await createUser(currentUser);
	ctx.scene.enter("mainScene");
});

process.once("SIGINT", () => {
	clearInterval(interval);
	bot.stop("SIGINT");
});
process.once("SIGTERM", () => bot.stop("SIGTERM"));
