// Slugs for villages made by the dev seed script. Pure, so it is tested without a database.
import { randomBytes } from 'node:crypto'

export const slugify = (name) => `${String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'village'}-${randomBytes(2).toString('hex')}`
