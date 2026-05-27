import { createServer, type Server } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { createWorkerApp } from '../../worker/src/index'

const DIST_DIR = resolve(import.meta.dirname, '../../client/dist')
const PORT_FILE = resolve(import.meta.dirname, '../.e2e-base-url')

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

const readDistFile = (pathname: string): Response | null => {
  const safePath = pathname === '/' ? '/index.html' : pathname
  const filePath = resolve(DIST_DIR, `.${safePath}`)
  if (!filePath.startsWith(DIST_DIR) || !existsSync(filePath)) {
    return null
  }
  const body = readFileSync(filePath)
  const type = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream'
  return new Response(new Uint8Array(body), { headers: { 'content-type': type } })
}

export const startLocalE2EServer = async (): Promise<Server> => {
  const app = createWorkerApp()
  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? '127.0.0.1'
      const url = new URL(req.url ?? '/', `http://${host}`)
      const isApi =
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/i/') ||
        url.pathname === '/health'

      let response: Response
      if (!isApi) {
        response =
          readDistFile(url.pathname) ??
          readDistFile('/index.html') ??
          new Response('EdgeMatte client dist missing. Run pnpm --filter @edge-matte/client build.', {
            status: 503,
          })
      } else {
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) {
          if (value === undefined) continue
          if (Array.isArray(value)) {
            for (const entry of value) headers.append(key, entry)
          } else {
            headers.set(key, value)
          }
        }
        const body =
          req.method === 'GET' || req.method === 'HEAD'
            ? undefined
            : await new Promise<Buffer>((resolveBody, rejectBody) => {
                const chunks: Buffer[] = []
                req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
                req.on('end', () => resolveBody(Buffer.concat(chunks)))
                req.on('error', rejectBody)
              })
        response = await app.fetch(
          new Request(url, {
            method: req.method,
            headers,
            body:
              body && body.length > 0
                ? new Uint8Array(body)
                : undefined,
          }),
        )
      }

      res.statusCode = response.status
      response.headers.forEach((value, key) => {
        res.setHeader(key, value)
      })
      const buffer = Buffer.from(await response.arrayBuffer())
      res.end(buffer)
    } catch (error) {
      res.statusCode = 500
      res.end(error instanceof Error ? error.message : 'E2E harness failure')
    }
  })

  await new Promise<void>((resolveListen) => {
    server.listen(0, '127.0.0.1', () => resolveListen())
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind local E2E server')
  }
  const baseUrl = `http://127.0.0.1:${address.port}`
  await writeFile(PORT_FILE, `${baseUrl}\n`, 'utf8')
  return server
}

export const stopLocalE2EServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()))
  })
}
