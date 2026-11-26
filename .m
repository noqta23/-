from aiogram import Bot, Dispatcher, types
from aiogram.client.default import DefaultBotProperties
from aiogram.utils.i18n import I18n, gettext as _, lazy_gettext as __
from aiogram.enums import ParseMode

# تحميل المتغيرات من ملف .env
from dotenv import load_dotenv
import os

# تحميل المتغيرات
load_dotenv()

# إعداد البوت
TOKEN = os.getenv("TOKEN")
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# تهيئة نظام الترجمة
i18n = I18n(path="locales", default_locale="ar", domain="messages")

# معالجة الرسائل
@dp.message()
async def start_command(message: types.Message):
    if message.text == "/start":
        await message.answer("أهلاً وسهلاً، اختر اللغة للمتابعة.")

# تشغيل البوت
async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())