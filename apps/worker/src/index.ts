const TEXT_HEADERS = { 'content-type': 'text/plain; charset=utf-8' }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...TEXT_HEADERS,
      'content-type': 'application/json; charset=utf-8',
    },
  })

const notFound = new Response('Not found', {
  status: 404,
  headers: TEXT_HEADERS,
})

export default {
  async fetch(request: Request) {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return json({ status: 'ok', version: '0.1.0' })
    }

    if (url.pathname === '/') {
      return new Response('EdgeMatte placeholder service', {
        status: 200,
        headers: TEXT_HEADERS,
      })
    }

    return notFound
  },
}
