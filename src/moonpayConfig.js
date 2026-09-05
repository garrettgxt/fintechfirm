// Coinstate Capital — MoonPay configuration
//
// 1. Sign up at https://dashboard.moonpay.com (instant, no approval needed)
// 2. Go to Developers > API Keys and copy your Test "Publishable Key"
//    (starts with pk_test_)
// 3. Paste it below
//
// This publishable key is safe for browser code — it's designed to be
// public, similar to the Supabase anon key. Your MoonPay SECRET key is
// different and must only ever be used in functions/ (Cloudflare Pages
// Functions, server-side), never here.

export const MOONPAY_API_KEY = "pk_test_5wCtPqHc6T5P122AIcVBvWVoimAAXDwi";

// Leave as "sandbox" until MoonPay approves your business (KYB) for
// production — the widget automatically matches whichever key you use.
export const MOONPAY_ENVIRONMENT = "sandbox";
