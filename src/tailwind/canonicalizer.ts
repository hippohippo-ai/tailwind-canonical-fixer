// 理想情况下，这里导入官方升级工具或社区包的 API
// import { suggestCanonicalClasses } from '@laststance/tailwind-suggest-canonical-classes';

export class Canonicalizer {
    public async init() {
        // 在这里可以加载用户的全局 CSS 获取 @theme 变量
        // 比如探测 workspaceFolders 中的 app.css
    }

    /**
     * 接收原始的类名字符串，返回标准化后的字符串
     */
    public fixClassString(rawString: string): string {
        // 1. 拆分类名 (保留连续空格以便完美还原格式)
        const parts = rawString.split(/(\s+)/);

        const fixedParts = parts.map(part => {
            if (part.trim() === '') return part; // 是空格，原样保留

            // ----------------------------------------------------
            // 【核心调用点】调用官方/社区 Canonical API
            // 真实场景: return suggestCanonicalClasses(part);
            // 下面是硬编码的示例（PoC 用）
            // ----------------------------------------------------
            return this.mockCanonicalApi(part);
        });

        return fixedParts.join('');
    }

    // 模拟 Tailwind API 行为
    private mockCanonicalApi(className: string): string {
        const rules: Record<string, string> = {
            'top-[68px]': 'top-17',
            'w-[64px]': 'w-16',
            'text-[red]': 'text-red',
            'px-[1rem]': 'px-4'
        };
        return rules[className] || className;
    }
}