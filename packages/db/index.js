// The one DB layer: village code uses Desker's own (api/_store.js), so planner data and village data share a connection style.
// village_ queries are added here from Checkpoint 2.
export { sql, loadDoc, saveDoc } from '../../api/_store.js'
