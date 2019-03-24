const frontMatter = require('front-matter')
const highlight = require('highlight.js')
const MarkdownIt = require('markdown-it')
const utils = require('loader-utils')


const DEFAULT_MARKDOWN_OPTIONS = {
    linkify: true,
    typographer: true,
    xhtmlOut: true,
    highlight(content, languageHint) {
        let highlightedContent;

        highlight.configure({
            useBR: true,
            tabReplace: '    '
        });

        if (languageHint && highlight.getLanguage(languageHint)) {
            try {
                highlightedContent = highlight.highlight(languageHint, content).value;
            } catch (err) {
            }
        }

        if (!highlightedContent) {
            try {
                highlightedContent = highlight.highlightAuto(content).value;
            } catch (err) {
            }
        }

        // 把代码中的{}转
        highlightedContent = highlightedContent.replace(/[\{\}]/g, (match) => `{'${match}'}`);

        // 加上 hljs
        highlightedContent = highlightedContent.replace('<code class="', '<code class="hljs ').replace('<code>', '<code class="hljs">')

        return highlight.fixMarkup(highlightedContent);
    }
}

const defaultOptions = {
    imports: `import React from 'react'\nimport 'highlight.js/styles/github.css'`,
    mdOptions: Object.assign({}, DEFAULT_MARKDOWN_OPTIONS),
    plugins: [],
    rules: {},
    preProcess: null,
    postProcess: null
}

function renderModule(imports, jsx) {
    const content = `
    ${imports}

    function MarkdownLoader() {
        return(
            <div className="doc">
                ${jsx}
            </div>
        )
    }

    export default MarkdownLoader
    `
    return content
}
module.exports = function (source) {
    this.cacheable()
    const options = utils.getOptions(this)

    const { imports, mdOptions, plugins, preProcess, postProcess, rules } = Object.assign({}, defaultOptions, options)
    
    const md = new MarkdownIt(mdOptions)

    // 处理rules
    for (let key of Object.keys(rules)) {
        const fn = rules[key]
        if (typeof fn === 'function') {
            md.renderer.rules[key] = fn
        } else {
            console.warn(`the rule '${key} is not a function`)
        }
    }

    //处理文本中{}
    const textFn = md.renderer.rules.text
    md.renderer.rules.text = function () {
        const ret = textFn.apply(this, arguments)
        return ret.replace(/[\{\}]/g, (match) => `{'${match}'}`)
    }

    // 处理plugins
    for (let plugin of plugins) {
        if (Array.isArray(plugin)) {
            md.use.apply(md, plugin)
        } else {
            md.use(plugin)
        }
    }


    // 处理preProcess
    if (typeof preProcess === 'function') {
        source = preProcess(source)
    }

    // 处理imports
    const { body, attributes: { imports: importMap } } = frontMatter(source)
    const allImports = `${imports}\n${importMap}`

    //render
    let content = md.render(body)
        .replace(/<hr>/g, '<hr />')
        .replace(/<br>/g, '<br />')
        .replace(/class=/g, 'className=')


    //后处理
    if (typeof postProcess === 'function') {
        content = preProcess(content)
    }

    // 生成组件
    return renderModule(allImports, content)
}