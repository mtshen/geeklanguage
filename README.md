# geeklanguage 1.0.0
该插件可以将国际化之后key, 转换为中文来增加代码可读性
GEEK+

## 设置
### `geekLanguage.languageUrl`
国际化内容请求接口, 填完整的请求中文的接口, 且无跨域要求

### `geekLanguage.languageJSON`
本地如果有JSON语言包, 如果有可以直接读本地的语言包

### `geekLanguage.regexp`
内置了对$L()与t()这种写法的国家化检查, 如果项目中存在其他形式的国际化, 可以在这里进行设置
