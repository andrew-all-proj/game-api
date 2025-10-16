import { Controller, Get, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'

@Controller('playground')
export class PlaygroundController {
  @Get()
  get(@Req() req: Request, @Res() res: Response) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http'
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost'
    const endpoint = `${proto}://${host}/graphql`

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>GraphQL Sandbox</title>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>html,body,#sandbox{height:100%;margin:0;}</style>
    <script src="https://embeddable-sandbox.cdn.apollographql.com/embeddable-sandbox.umd.production.min.js" crossorigin="anonymous"></script>
  </head>
  <body>
    <div id="sandbox"></div>
    <script>
      new window.ApolloSandbox({
        target: "#sandbox",
        initialEndpoint: ${JSON.stringify(endpoint)},
        includeCookies: true
      });
    </script>
  </body>
</html>`
    res.type('html').send(html)
  }
}
