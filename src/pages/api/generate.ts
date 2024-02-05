import { ProxyAgent, fetch } from 'undici'
import { generatePayload, parseOpenAIStream } from '@/utils/openAI'
import { verifySignature } from '@/utils/auth'
import type { APIRoute } from 'astro'

const apiKeys = import.meta.env.OPENAI_API_KEYS.split(',') || []
const httpsProxy = import.meta.env.HTTPS_PROXY
const baseUrl = (import.meta.env.OPENAI_API_BASE_URL || 'https://api.openai.com').trim().replace(/\/$/, '')
const sitePassword = import.meta.env.SITE_PASSWORD || ''
const passList = sitePassword.split(',') || []

export const post: APIRoute = async (context) => {
  const body = await context.request.json()
  const { sign, time, messages, pass, temperature } = body
  if (!messages) {
    return new Response(JSON.stringify({
      error: {
        message: 'No input text.',
      },
    }), { status: 400 })
  }
  if (sitePassword && !(sitePassword === pass || passList.includes(pass))) {
    return new Response(JSON.stringify({
      error: {
        message: 'Invalid password.',
      },
    }), { status: 401 })
  }
  if (import.meta.env.PROD && !await verifySignature({ t: time, m: messages?.[messages.length - 1]?.content || '' }, sign)) {
    return new Response(JSON.stringify({
      error: {
        message: 'Invalid signature.',
      },
    }), { status: 401 })
  }

  const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)]
  const initOptions = generatePayload(apiKey, messages, temperature)
  if (httpsProxy) {
    initOptions.dispatcher = new ProxyAgent(httpsProxy)
  }

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, initOptions)
    return parseOpenAIStream(response)
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({
      error: {
        code: err.name,
        message: err.message,
      },
    }), { status: 500 })
  }
}