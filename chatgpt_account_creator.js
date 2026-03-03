import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as cheerio from 'cheerio';
import { faker } from '@faker-js/faker';

class ChatGPTAccountCreator {
    constructor() {
        this.telegramToken = process.env.TELEGRAM_TOKEN;
        this.telegramChatId = process.env.TELEGRAM_CHAT_ID;
        this.config = {
            password: process.env.PASSWORD || "Jembut.789011",
            numAccounts: parseInt(process.env.NUM_ACCOUNTS) || 1
        };
    }

    log(message) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(11, 19);
        console.log(`[${timestamp}] 🤖 ${message}`);
    }

    async sendToTelegram(message) {
        try {
            await fetch(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: this.telegramChatId, text: message, parse_mode: 'Markdown' })
            });
        } catch (e) { this.log(`Gagal kirim Telegram: ${e.message}`); }
    }

    async getOTP(email, maxRetries = 15) {
        const [user, domain] = email.split('@');
        this.log(`⏳ Menunggu OTP untuk ${email}...`);
        for (let i = 0; i < maxRetries; i++) {
            try {
                const res = await fetch(`https://generator.email/${domain}/${user}`);
                const html = await res.text();
                const $ = cheerio.load(html);
                const bodyText = $('body').text();
                const otpMatch = bodyText.match(/\b\d{6}\b/);
                if (otpMatch) return otpMatch[0];
            } catch (e) { }
            await new Promise(r => setTimeout(r, 10000));
        }
        return null;
    }

    async generateEmail() {
        try {
            const res = await fetch('https://generator.email/');
            const text = await res.text();
            const $ = cheerio.load(text);
            const domains = [];
            $('.e7m.tt-suggestions div > p').each((i, el) => domains.push($(el).text()));
            const domain = domains.length > 0 ? domains[Math.floor(Math.random() * domains.length)] : "gmail.com";
            return `${faker.internet.userName().toLowerCase()}${uuidv4().substring(0,4)}@${domain}`;
        } catch (e) { return faker.internet.email().toLowerCase(); }
    }

    async run() {
        this.log("🚀 Memulai proses di GitHub Actions...");
        for (let i = 1; i <= this.config.numAccounts; i++) {
            const email = await this.generateEmail();
            this.log(`[${i}/${this.config.numAccounts}] Target: ${email}`);

            const browser = await firefox.launch({ headless: true });
            const page = await (await browser.newContext()).newPage();

            try {
                await page.goto('https://chatgpt.com/auth/login', { waitUntil: 'networkidle', timeout: 60000 });
                await page.click('button:has-text("Sign up")');
                
                await page.waitForSelector('input#email-address', { timeout: 15000 });
                await page.fill('input#email-address', email);
                await page.click('button[type="submit"]');

                await page.waitForSelector('input#password', { timeout: 15000 });
                await page.fill('input#password', this.config.password);
                await page.click('button:has-text("Continue")');

                const otp = await this.getOTP(email);
                if (!otp) throw new Error("OTP Timeout");

                await page.fill('input[aria-label="Digit 1"]', otp);
                await page.waitForSelector('input[name="firstname"]', { timeout: 20000 });
                await page.fill('input[name="firstname"]', faker.person.firstName());
                await page.fill('input[name="lastname"]', faker.person.lastName());
                await page.fill('input[name="birthday"]', "01/01/1990");
                await page.click('button:has-text("Agree")');

                await this.sendToTelegram(`✅ *Akun Berhasil!*\n📧 \`${email}\` \n🔑 \`${this.config.password}\``);
            } catch (err) {
                this.log(`❌ Gagal: ${err.message}`);
                await page.screenshot({ path: `error_${i}.png` });
            } finally {
                await browser.close();
            }
        }
    }
}

new ChatGPTAccountCreator().run();
