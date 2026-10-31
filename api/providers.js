// Which social sign-in buttons the login screen shows: only providers whose keys are configured.
import { socialProviders } from './_auth.js'

export default (req, res) => res.setHeader('cache-control', 'public, max-age=300').json(socialProviders)
