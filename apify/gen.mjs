// Generates the machine files of each Actor directory from actors.json + _shared + the satellite dist.
// README.md is hand-written per Actor and is NOT touched. Run: node gen.mjs
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sat = join(here, '..', 'satellites');
const actors = JSON.parse(readFileSync(join(here, 'actors.json'), 'utf8'));
const w = (p, o) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, typeof o === 'string' ? o : JSON.stringify(o, null, 4) + '\n'); };

for (const a of actors) {
    const d = join(here, a.dir);
    const srcPkg = JSON.parse(readFileSync(join(sat, a.repo, 'package.json'), 'utf8'));
    const checks = [
        ['title 40-50', a.title.length >= 40 && a.title.length <= 50],
        ['seoTitle 40-50', a.seoTitle.length >= 40 && a.seoTitle.length <= 50],
        ['seoDescription 140-156', a.seoDescription.length >= 140 && a.seoDescription.length <= 156],
        ['description <=300', a.description.length <= 300],
    ];
    for (const [n, ok] of checks) if (!ok) console.error(`WARN ${a.dir}: ${n} (title=${a.title.length} seoTitle=${a.seoTitle.length} seoDesc=${a.seoDescription.length} desc=${a.description.length})`);

    // shared code
    rmSync(join(d, 'src'), { recursive: true, force: true });
    cpSync(join(here, '_shared', 'src'), join(d, 'src'), { recursive: true });
    cpSync(join(here, '_shared', 'Dockerfile'), join(d, 'Dockerfile'));
    cpSync(join(here, '_shared', '.dockerignore'), join(d, '.dockerignore'));

    // vendored server: compiled dist of the satellite repo, minus the Cloudflare Worker and landing page entry points
    rmSync(join(d, 'server'), { recursive: true, force: true });
    mkdirSync(join(d, 'server'), { recursive: true });
    for (const f of readdirSync(join(sat, a.repo, 'dist'))) {
        if (f === 'worker.js' || f === 'landing.js') continue;
        cpSync(join(sat, a.repo, 'dist', f), join(d, 'server', f));
    }
    for (const f of ['LICENSE', 'DATA_SOURCES.md']) if (existsSync(join(sat, a.repo, f))) cpSync(join(sat, a.repo, f), join(d, 'server', f));

    w(join(d, 'package.json'), {
        name: a.dir, version: '1.0.0', type: 'module', private: true, description: a.description,
        engines: { node: '>=22' },
        dependencies: { '@modelcontextprotocol/sdk': '^1.30.0', apify: '^3.7.0', express: '^5.1.0', zod: '^3.25.76' },
        scripts: { start: 'node src/main.js' },
        license: srcPkg.license || 'MIT',
    });
    w(join(d, 'actor.config.json'), { title: a.title, sampleTool: a.sampleTool, sampleArgs: a.sampleArgs });
    w(join(d, '.actor', 'actor.json'), {
        $schema: 'https://apify.com/schemas/v1/actor.ide.json',
        actorSpecification: 1,
        name: a.dir,
        title: a.title,
        description: a.description,
        version: '1.0',
        buildTag: 'latest',
        usesStandbyMode: true,
        meta: { templateId: 'ts-mcp-proxy', generatedBy: 'adapted from apify/actor-templates ts-mcp-proxy (plain JS)' },
        minMemoryMbytes: 256,
        defaultMemoryMbytes: 512,
        maxMemoryMbytes: 1024,
        input: './input_schema.json',
        output: './output_schema.json',
        storages: { dataset: './dataset_schema.json' },
        dockerfile: '../Dockerfile',
        readme: '../README.md',
        webServerMcpPath: '/mcp',
    });
    w(join(d, '.actor', 'input_schema.json'), {
        title: `${a.title}: input`,
        description: 'This Actor is an MCP server and takes no input. Connect an MCP client to its Standby URL (path /mcp) with the header Authorization: Bearer <your Apify API token>. A normal run only performs a self-check and is free.',
        type: 'object',
        schemaVersion: 1,
        properties: {},
        required: [],
    });
    w(join(d, '.actor', 'output_schema.json'), {
        $schema: 'https://apify.com/schemas/v1/output.ide.json',
        actorOutputSchemaVersion: 1,
        title: 'Output schema',
        properties: {
            selfCheck: { type: 'string', title: 'Self-check report (tools list and one sample call)', template: '{{links.apiDefaultKeyValueStoreUrl}}/records/OUTPUT' },
            results: { type: 'string', title: 'Dataset', template: '{{links.apiDefaultDatasetUrl}}/items' },
        },
    });
    w(join(d, '.actor', 'dataset_schema.json'), {
        $schema: 'https://apify.com/schemas/v1/dataset.ide.json',
        actorSpecification: 1,
        fields: {
            type: 'object',
            properties: {
                actor: { type: 'string' },
                mcpEndpoint: { type: ['string', 'null'] },
                howToConnect: { type: 'string' },
                toolCount: { type: 'integer' },
                tools: { type: 'array' },
                sampleCall: { type: 'object' },
            },
        },
        views: {
            overview: {
                title: 'Self-check',
                transformation: { fields: ['actor', 'mcpEndpoint', 'toolCount'] },
                display: { component: 'table', properties: { actor: { label: 'Actor' }, mcpEndpoint: { label: 'MCP endpoint' }, toolCount: { label: 'Tools' } } },
            },
        },
    });
    // Reference copy only: the platform ignores this file (see PUBLISH.md).
    w(join(d, '.actor', 'pay_per_event.json'), {
        'tool-call': {
            eventTitle: 'Tool call',
            eventDescription: `One successful MCP tool call on ${a.title}. Listing tools and initializing are free.`,
            eventPriceUsd: a.priceUsd,
        },
    });
    // Store fields the CLI does not push (seo, categories, pricing, standby): consumed by publish-all.sh step 2.
    w(join(d, '.actor', 'store-config.json'), {
        title: a.title,
        description: a.description,
        seoTitle: a.seoTitle,
        seoDescription: a.seoDescription,
        categories: a.categories,
        actorStandby: { isEnabled: true, idleTimeoutSecs: 300 },
        pricingInfos: [{
            pricingModel: 'PAY_PER_EVENT',
            pricingPerEvent: { actorChargeEvents: {
              'apify-actor-start': {
                eventTitle: 'Actor start',
                eventDescription: 'Apify synthetic event: covers the first 5 seconds of compute of each run. Charged by the platform, not by the Actor code.',
                eventPriceUsd: 0.00005,
              },
              'tool-call': {
                eventTitle: 'Tool call',
                eventDescription: `One successful MCP tool call on ${a.title}. Listing tools and initializing are free.`,
                eventPriceUsd: a.priceUsd,
                isPrimaryEvent: true,
            } } },
            minimalMaxTotalChargeUsd: Math.round(a.priceUsd * 5 * 1000) / 1000,
            isPPEPlatformUsagePaidByUser: false,
        }],
    });
    w(join(d, '.gitignore'), 'node_modules\nstorage\napify_storage\n.env\n');
    console.log('generated', a.dir, `title=${a.title.length} seoTitle=${a.seoTitle.length} seoDesc=${a.seoDescription.length} desc=${a.description.length}`);
}
