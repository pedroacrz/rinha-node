import Pool from 'pg-pool' 
import express from 'express'
import {randomUUID} from 'crypto'

const app = express()
app.use(express.json())
 
 
const pool = new Pool({
    host: 'localhost',
    password: 'docker',
    user: 'postgres',
    port: 5432,
    max: 10
})

const connection = await pool.connect();
  
app.get("/contagem-pessoas", async (req,res) => {
    const pessoas = await connection.query('select count(apelido) from pessoas', [])
    return res.send(pessoas.rows[0].count)
})

app.get('/pessoas', async (req,res) => {
    const { t } = req.query;
    if(!t) return res.status(400).send();
    
    const pessoas = await connection.query(`SELECT
            id,
            apelido,
            nome,
            to_char(nascimento, 'YYYY-MM-DD') as nascimento,
            stack
        FROM
            pessoas
        WHERE
            searchable ILIKE $1
        LIMIT 50;`, [`%${t}%`])
    return res.json(pessoas.rows)
})

app.get('/clean', async (req,res) => {
    const pessoas = await connection.query("delete from pessoas;", [])
    if(pessoas) { return res.send()}
})

app.get('/pessoas/:id', async (req,res) => {
    const {id} = req.params;
    if(!id) return res.status(404).send();  
    const pessoas = await connection.query("select id, nome, apelido, to_char(nascimento, 'YYYY-MM-DD') as nascimento, stack from pessoas where id = $1", [id])
    if(pessoas) { return res.json(pessoas.rows[0])}
})

app.post('/pessoas', async (req,res) => {
    let { stack, nome, apelido, nascimento} = req.body;
    if(!nome || !apelido || !nascimento) return res.status(422).send()
    if(nome.length > 100 || apelido.length > 32) return res.status(422).send()
    if(typeof(nome) !== 'string' || typeof(apelido) !== 'string' || typeof(nascimento) !== 'string' || typeof(stack) === 'string'){
        return res.status(400).send()
    }
    
    if(stack === null || typeof(stack) !== 'object') stack = ['']
    const invalidDate = isNaN(new Date(nascimento))
    if(invalidDate) { return res.status(422).send()}
    let [year, month, day] = nascimento.split('-')
    if(typeof(Number(day)) !== 'number' ||typeof(Number(month)) !== 'number' || typeof(Number(year)) !== 'number') {return res.status(422).send();}
    if(year < 1900 || month < 1 || month > 12 || day < 1 || day > 31 || month == Number('02') && day > 28 ) return res.status(400).send()

    if(stack.length > 0) { 
        for(const stack_name of stack) if(typeof(stack_name) !== 'string' || stack_name.length > 32) return res.status(400).send()
    }

    const id = randomUUID()
    
        try{
            const query = `INSERT INTO
            pessoas(
            id,
            apelido,
            nome,
            nascimento,
            stack
            )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5::json
        )`
        await connection.query(query, [id,nome,apelido,nascimento,JSON.stringify(stack)])
        return res.status(201).location(`/pessoas/${id}`).send()
    } catch(err) {return res.status(422).send()}
})

app.listen(process.env.PORT, () => { console.log('App running')})