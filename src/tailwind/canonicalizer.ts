export class Canonicalizer {
    public async init() {
        // 初始化配置
    }

    /**
     * 接收原始类名字符串，返回规范化后的 Tailwind v4 类名
     */
    public fixClassString(rawString: string): string {
        if (!rawString || rawString.trim() === '') return rawString;

        // 1. 保留空格格式拆成分词
        const parts = rawString.split(/(\s+)/);

        const fixedParts = parts.map(part => {
            if (part.trim() === '') return part;
            return this.canonicalizeSingleClass(part);
        });

        return fixedParts.join('');
    }

    private canonicalizeSingleClass(cls: string): string {
        let isImportant = false;
        let workCls = cls;

        // 规则 1: 处理 v4 前缀 ! 移动到后缀 (例: !bg-red -> bg-red!, !bg-[#061912] -> bg-[#061912]!)
        if (workCls.startsWith('!')) {
            isImportant = true;
            workCls = workCls.slice(1);
        }

        // 处理变体修饰符 (例: hover:!bg-red -> hover:bg-red!)
        const variantParts = workCls.split(':');
        let utility = variantParts.pop() || '';
        const variants = variantParts;

        if (utility.startsWith('!')) {
            isImportant = true;
            utility = utility.slice(1);
        }

        // 规则 2: 转换 Utility Class 核心逻辑
        utility = this.canonicalizeUtility(utility);

        // 重新拼接变体
        let result = variants.length > 0 ? `${variants.join(':')}:${utility}` : utility;

        // 追加 v4 后缀 !
        if (isImportant && !result.endsWith('!')) {
            result += '!';
        }

        return result;
    }

    private canonicalizeUtility(utility: string): string {
        // A. 规范化层级/透明度/比例 (例: z-[100] -> z-100, opacity-[50%] -> opacity-50)
        const scaleMatch = utility.match(/^(z|opacity|order|flex-grow|flex-shrink|grow|shrink)-\[(\d+(\.\d+)?)%?\]$/);
        if (scaleMatch) {
            return `${scaleMatch[1]}-${scaleMatch[2]}`;
        }

        // B. 规范化负角度 (例: rotate-[-12deg] -> -rotate-12, skew-x-[-5deg] -> -skew-x-5)
        const negRotateMatch = utility.match(/^(rotate|skew-x|skew-y)-\[-(\d+(\.\d+)?)deg\]$/);
        if (negRotateMatch) {
            return `-${negRotateMatch[1]}-${negRotateMatch[2]}`;
        }

        // C. 规范化正角度 (例: rotate-[12deg] -> rotate-12)
        const posRotateMatch = utility.match(/^(rotate|skew-x|skew-y)-\[(\d+(\.\d+)?)deg\]$/);
        if (posRotateMatch) {
            return `${posRotateMatch[1]}-${posRotateMatch[2]}`;
        }

        // D. px 转换为 Tailwind v4 标尺数值 (例: min-h-[115px] -> min-h-28.75, top-[68px] -> top-17, w-[64px] -> w-16)
        const pxMatch = utility.match(/^(-)?(w|h|min-w|max-w|min-h|max-h|top|bottom|left|right|p|pt|pb|pl|pr|px|py|m|mt|mb|ml|mr|mx|my|gap|space-x|space-y|inset|inset-x|inset-y|translate-x|translate-y|rounded)-\[(\d+(\.\d+)?)px\]$/);
        if (pxMatch) {
            const isNegative = pxMatch[1] || '';
            const prefix = pxMatch[2];
            const pxVal = parseFloat(pxMatch[3]);
            
            // v4 换算规则：1 unit = 4px (115 / 4 = 28.75)
            const scaleVal = Number((pxVal / 4).toFixed(4)); 
            return `${isNegative}${prefix}-${scaleVal}`;
        }

        // E. 规范化颜色名称 (例: text-[red] -> text-red)
        const colorMatch = utility.match(/^(text|bg|border|ring|outline)-\[([a-zA-Z]+)\]$/);
        if (colorMatch) {
            return `${colorMatch[1]}-${colorMatch[2]}`;
        }

        return utility;
    }
}