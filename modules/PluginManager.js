const Emojis = require('./Emojis');
const fs = require('fs')

class PluginManager {
    constructor(client) {
        this.client = client;
        /** @type {Map<string, import("./BasePlugin")>} */
        this.plugins = new Map();
        this.events = new Set(); // Set is like array but more flexible
    }

    init() {
        console.log(`[Plugin Manager] Loading plugins...`)
        const plugins = fs.readdirSync("./plugins").filter(file => file.endsWith(".js"));
        plugins.forEach(file => {
            this.load(file)
        });
    }

    load(pluginName) {
        try {
            const plugin = require(`../plugins/${pluginName}`);
            const _plugin = new plugin;
            _plugin.loadCommands()
            this.add(_plugin)
        } catch (error) {
            console.error("[Plugin Manager] Unable to load " + pluginName + ": " + error)
            return { error }
        }
        return {}
    }

    add(plugin) {
        this.plugins.set(plugin.about.name, plugin);
        console.log(`[Plugin Manager] ${plugin.about.name} loaded`)
        if (!this.events.has(plugin.conf.event)) {
            const event = plugin.conf.event
            this.events.add(event);
            this.client.on(event, async (...args) => {

                // Executes all enabled plugins
                for (let [name, plugin] of this.plugins) {
                    if (plugin.conf.enabled && plugin.conf.event == event)
                        await plugin.run(this.client, ...args);
                }
            })
        }
    }

    reload(pluginName) {
        return this.unload(pluginName) ? (this.load(pluginName)?.error ? false : true) : false
    }
    
    unload(pluginName) {
        let tru = (pluginName) => { console.log(`[Plugin Manager] ${pluginName} unloaded`); return true }
        return this.plugins.delete(pluginName) ? tru(pluginName) : false;
    }

    enable(pluginName) {
        if(!this.plugins.get(pluginName)) return false
        let tru = (pluginName) => { console.log(`[Plugin Manager] ${pluginName} enabled`); return true }
        return this.plugins.get(pluginName).conf.enabled = true ? tru(pluginName) : false;
    }

    disable(pluginName) {
        if(!this.plugins.get(pluginName)) return false
        let tru = (pluginName) => { console.log(`[Plugin Manager] ${pluginName} disabled`); return true }
        return !(this.plugins.get(pluginName).conf.enabled = false) ? tru(pluginName) : false;
    }

    isLoaded(pluginName) {
        return this.plugins.get(pluginName) ? this.plugins.get(pluginName).conf.enabled : false
    }

    info(pluginName) {
        if(!this.plugins.get(pluginName)) return {error: "Invalid plugin name"}
        return {
            description: this.plugins.get(pluginName).about.info,
            enabled: this.plugins.get(pluginName).conf.enabled,
            loaded: true,
            event: this.plugins.get(pluginName).conf.event
        }
    }
    
    get list() {
        return {
            loaded: [...this.plugins.values()].map(plugin => `${this.isLoaded(plugin.about.name) ? Emojis.greenTick : Emojis.redTick} **${plugin.about.name}**`).join("\n"),
            unloaded: fs.readdirSync("./plugins").filter(file => file.endsWith(".js")).map(fl => fl.split(".")[0]).filter(plg => ![...this.plugins.keys()].includes(plg)).map(plugin => `**${plugin}**`).join("\n")
        }
    }

    getCommand(cmd) {
        const match = [...this.plugins.values()].find(plugin => {
            return plugin && plugin.commands && plugin.commands.has(cmd)
        });
        //console.log(match);
        if (!match)
            return null;
        return match.commands.get(cmd);
    }

    get commands() {
        return [...this.plugins.values()].filter(plugin => {
            return plugin && plugin.commands && plugin.commands.size
        }).map(plugin => plugin.commands.array()).flat();
    }
}

module.exports = PluginManager