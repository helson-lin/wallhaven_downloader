const request = require('request');
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
const download = require('download');
const input = require('input');
/**
 * @description 下载图片
 * @param url 下载地址
 * @returns
 */
const getImage = (url: string): Promise<ImageInfo[] | null> => {
    return new Promise((resolve, reject) => {
        request({
            url,
            method: 'GET',
        }, (err: Error, response: Response) => {
            if (err) {
                console.log("请求页面错误:" + url, err);
                resolve(null);
            } else {
                if (!response || !response?.body) {
                    console.log("Error: " + response);
                    resolve(null);
                } else {
                    const $ = cheerio.load(response.body);
                    const figure = $('img.lazyload');
                    const urlList: ImageInfo[] = [];
                    figure.each((index: number, item: any) => {
                        const url = $(item).attr('data-src');
                        const size = $($('span.wall-res')[index])?.html();
                        let fullUrl = url.replace('https://th.wallhaven', 'https://w.wallhaven');
                        fullUrl = fullUrl.replace('small', 'full');
                        const urlPng = fullUrl.split('/').splice(-1, 3)[0];
                        fullUrl = fullUrl.replace(urlPng, 'wallhaven-' + urlPng);
                        urlList.push({
                            fullUrl,
                            smallUrl: url,
                            size: size
                        });
                    })
                    resolve(urlList);
                }
            }
        })
    })
}

/**
 * @description 并发下载图片
 * @param urlList 下载图片PromiseList
 * @param title 下载提示标题
 */
const downloadImage = async (promiseList: Promise<any>[], urlList: ImageInfo[], title?: string): Promise<void> => {
    let urls = promiseList;
    let len = promiseList.length;
    let finished = 0;
    let pool: Promise<any>[] = []; // 并发池
    let max = 4;
    for (let i = 0; i < urls.length; i++) {
        let downloadPromise = urls[i];
        downloadPromise.then(() => {
            pool.splice(pool.indexOf(downloadPromise, 1));
            finished += 1;
            console.log(`[${title || "Downloaded"}] 当前完成：${finished}/${len}`)
            if (finished === len) {
                console.log(`[${title || "Downloaded"}] Completed`);
                return Promise.resolve();
            }
        }).catch(() => {
            pool.splice(pool.indexOf(downloadPromise, 1));
            finished += 1;
            console.log(`[${title || "Download Failed"}] 当前完成：${finished}/${len}`)
            if (finished === len) {
                console.log(`[${title || "Downloaded"}] Completed`);
                return Promise.resolve();
            }
        })
        pool.push(downloadPromise)
        if (pool.length === max) {
            await Promise.race(pool).catch((err: Error) => {
                console.log("并发下载发生错误:", err);
            });
        }
    }
}

/**
 * @description: 下载wallhaven壁纸
 * @param { haveOptions } options 下载地址
 * @param start 起始页码
 * @param end 结束页码
 */
const getWallHavenImageWidthPages = (options: HavenOptions, start: number, end: number): Promise<boolean | void> => {
    const params = Object.entries(options).reduce((pre, keyValues) => {
        if (!pre) {
            return pre += `https://wallhaven.cc/search?${keyValues[0]}=${keyValues[1]}`
        } else {
            return pre += `&${keyValues[0]}=${keyValues[1]}`
        }
    }, "")
    const downloadPath = Object.values(options).sort().join("/");
    const promises = [];
    // 请求所有页面的数据
    for (let i = start; i <= end; i++) {
        const reqUrl = `${params}&page=${i}`;
        promises.push(getImage(reqUrl));
    }
    // // 并发请求数据
    return Promise.allSettled(promises).then(async (urlsStatus) => {
        // 过滤掉失败请求的页面
        const urls = await urlsStatus.filter(item => item.status === 'fulfilled' && item.value).map(p => (p as PromiseFulfilledResult<any>).value);
        const urlsList = urls.reduce((acc, url) => {
            if (url) {
                return acc.concat(url);
            } else {
                return acc;
            }
        }, []);
        const downloadFullUrls = urlsList.map((item: ImageInfo) => item.fullUrl);
        const pathDir = path.join(process.cwd(), `../imgs/full/${downloadPath}`)
        return downloadImage(
            downloadFullUrls.map((url: string) => download(url, pathDir).catch((err: Error) => console.log("DOWNLOAD ERROR: \n" + err))),
            urls,
            "Full-IMG").then(() => {
                console.log("------------FININSHED-----------")
                return true;
            })
    })
}

/**
 * @description 保存下载json
 * @param name 文件名称
 * @param text 文本
 */
const downloadJson = (name: string, text: string): void => {
    const dirPath = path.join(process.cwd(), './json');
    if (fs.existsSync(dirPath) === false) {
        fs.mkdirSync(dirPath);
    }
    fs.writeFileSync(path.join(dirPath, name), text, 'utf8');
}

async function askStuff() {
    const sortSelect: Dictionary = { 热门: 'hot', 排行榜: 'toplist', 随机: 'random', 实用性: 'relevance', 下载量: 'views' };
    const sizeSelect: Dictionary = { '4k': '3840x2160', '2k': '2560x1440', '1080p': '1920x1080' };
    const orderSelect: Dictionary = { '增序': 'asc', '降序': 'desc' }
    const typeSelect: Dictionary = { '动漫': '010', '写真': '001', '一般': '100', '所有': '111' }
    const purity = '100';
    const type: string = await input.select('请选择类型', Object.keys(typeSelect));
    const atleast: string = await input.select('请选择尺寸', Object.keys(sizeSelect));
    const sorting = await input.select(`请选择分类：`, Object.keys(sortSelect));
    const order: string = await input.select('请选择排序', Object.keys(orderSelect));
    const startPage = await input.text('请输入开始页码', { default: '1' });
    const endPage = await input.text('请输入结束页码', { default: '5'});
    const params: HavenOptions = {
        sorting: sortSelect[sorting] as Sorting,
        atleast: sizeSelect[atleast] as Atleast,
        order: orderSelect[order] as Order,
        categories: typeSelect[type] as Category,
        purity: "100",
    };
    console.log('You chose:\n', `类型: ${type}; 尺寸: ${atleast}; 分类: ${sorting}; 排序: ${order}`, "开始下载");
    await getWallHavenImageWidthPages(params, Number(startPage), Number(endPage));
}
askStuff();
