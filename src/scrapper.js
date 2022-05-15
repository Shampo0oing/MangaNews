let fs = require('fs');
const axios = require('axios').default;
const cheerio = require('cheerio');
//mangadex api
const mangadex = require('./auth.js');
const labels = require('./labelContents.json')

async function fethHtml (url, config = null){
    try {
        const { data } = await axios.get(url, config);
        return data;
    } catch (err){
        console.error(
            `ERROR: An error occurred while trying to fetch the URL: ${url}`
        );
        console.error(err);
        return null;
    }
}

function stringify (url) {

    return encodeURIComponent(url);
}

async function scrapWebnovel(novelName) {

    const searchUrl = `https://www.webnovel.com/search?keywords=${stringify(novelName)}`;
    const baseUrl = 'https://www.webnovel.com';
    let html = await fethHtml(searchUrl);
    let $ = cheerio.load(html);
    const firstNovel = $('.j_list_container.search-result-container').find('ul.ser-ret.lh1d5.j_result_wrap').find('li').first();

    let novel = {
        image: 'https:' + firstNovel.find('.g_thumb > img').attr('src'),
        webnovelUrl: baseUrl + firstNovel.find('h3.mb8.g_h3 > a').attr('href').split("'").join('%27'),
        title: firstNovel.find('h3.mb8.g_h3 > a').attr('title'),
        rating: firstNovel.find('.g_star_num.mb5.fs12').children('small').text()
    }

    html = await fethHtml(novel.webnovelUrl, {
        maxRedirects: 1
    });
    $ = cheerio.load(html);

    const body = $('.g_wrap').find('.det-info.g_row.c_000.fs16.pr');

    novel.type = body.find('.mb12.lh24.det-hd-detail.c_000.fs0').children('a').attr('title');
    novel.author = body.find('.lh20.mb24.pr').find('.ell.dib.vam').children(':nth-child(2)').text();

    body.find('.mb12.lh24.det-hd-detail.c_000.fs0').children('strong').each((i, el) => {

        if ($(el).find('use').attr('href') === '#i-pen')
            novel.status = $(el).find('span').first().text();
        else if($(el).find('use').attr('href') === '#i-chapter')
            novel.latestChapter = $(el).find('span').first().text();
        else if($(el).find('use').attr('href') === '#i-eye')
            novel.views = $(el).find('span').first().text();
    })

    const latestChapter = $('div.fs16.det-con-ol.oh.j_catalog_list').find('div.volume-item').last().find('ol.clearfix.g_row.content-list.mb32').children().last();
    console.log($('.g_wrap.det-con.mb32.j_catalog_wrap').children().html());
    const isLocked = latestChapter.find('svg.fr._icon.ml16.mt4.c_s.fs16');
    console.log(isLocked.length);
    if (!isLocked.length)
        novel.latestWebnovelLink = latestChapter.find('a').attr('href');
    let tags = [];
    $('.det-tab-pane._on').find('.j_tagWrap').find('.m-tags').find('p').each((i, el) => {
        tags.push($(el).text().split('#').join('').trim());
    } )
    novel.tags = tags;

    return novel;

}

async function scrapWuxiaWorld(novelName, novel) {

    const baseUrl = 'https://www.wuxiaworld.co';
    const searchUrl = `${baseUrl}/search/${encodeURIComponent(novel.title)}/1`;
    console.log(searchUrl);
    //search novel loading
    let html = await fethHtml(searchUrl);
    let $ = cheerio.load(html);
    const firstManga = $('ul.result-list').find('li.list-item').first();
    novel.wuxiaLink = baseUrl + firstManga.find('div.item-info > a.book-name').attr('href');
    //novel page loading
    html = await fethHtml(novel.wuxiaLink);
    $ = cheerio.load(html);

    novel.latestWuxiaLink = baseUrl + $('div.chapter-wrapper > div.chapter-header.clearfix > a.newest-chapter').attr('href');
    console.log(novel.latestWuxiaLink);
    return novel;
}


function Collect(a, b, c, d) {
    for (let property in b)
        a[property] = b[property];

    for (let property in c)
        a[property] = c[property];

    for (let property in d)
        a[property] = d[property];

    return a;
}

async function scrapMangaUpdates(mangaName) {

    const searchUrl = 'https://www.mangaupdates.com/series.html?search=' + mangaName + '&orderby=rating';

    let html = await fethHtml((searchUrl));

    let $ = cheerio.load(html);

    const mangaUrl = $('.p-2.pt-2.pb-2.text')
        .find('.col-12.col-lg-6.p-3.text')
        .first()
        .find('.text > a')
        .attr('href');

    let manga = {};

    if (!mangaUrl)
        throw new Error('manga not found');

    html = await fethHtml(mangaUrl);
    $ = cheerio.load(html);

    manga.title = $('.releasestitle.tabletitle')
        .text().trim();


    const firstColums = $('.row.no-gutters')
        .children('.col-6.p-2.text')
        .first();

    const secondColums = $('.row.no-gutters')
        .children('.col-6.p-2.text')
        .first().next();

    firstColums.find('div.sCat').each((i, el) => {

        switch ($(el).find('b').text())
        {
            case 'Description':
                manga.description = $(el).next('div.sContent').contents().first().text().trim();

                if (manga.description === ''){

                    manga.description = $(el).next('div.sContent').find('div#div_desc_more').contents().first().text().trim();
                }
                break;

            case 'Type':
                manga.type = $(el).next('div.sContent').text().trim();
                break;

            case 'Latest Release(s)':
                manga.latestChapter= $(el).next('div.sContent').contents().text();

                manga.latestChapter = manga.latestChapter.split('by')[0].trim();

                manga.translator = $(el).next('div.sContent').find('a').first().text().trim();

                manga.timeAgo = $(el).next('div.sContent').find('span').first().attr('title');

                break;

            case 'User Rating':
                manga.rating = $(el).next('div.sContent').find('b').text().trim() + ' /10';
                break;

            case 'Last Updated':
                manga.infoUpdate = $(el).next('div.sContent').text().trim();
                break;
        }
    });

    secondColums.find('div.sCat').each((i, el) => {

        switch ($(el).find('b').text())
        {
            case 'Image':
                manga.thumbnaillUrl = $(el).next('div.sContent')
                    .find("center > img.img-fluid")
                    .attr('src');
                break;

            case 'Genre':
                let genre = [];
                $(el).next('div.sContent').find('a').each((i,el2) => {

                    const notEmpty = $(el2).children('u').text().trim();
                    if (notEmpty)
                        genre.push(notEmpty);
                })
                manga.genre = genre.join(', ');
                break;

            case 'Author(s)':
                manga.author = $(el).next('div.sContent').contents().first().text().trim().split('[')[0];
                break;

            case 'Artist(s)':
                manga.artist = $(el).next('div.sContent').contents().first().text().trim().split('[')[0];
                break;

            case 'English Publisher':
                const publisher = $(el).next('div.sContent').find("a[title = 'Publisher Info'] > u").first().text();
                if(publisher)
                    manga.publisher = publisher;
                else
                    manga.publisher = 'N/A';
                break;
        }
    });

    return manga;
}

async function scrapMangaHub(mangaName, manga) {

    let searchUrl;
    if (manga)
        searchUrl = `https://mangahub.io/search?q=${encodeURIComponent(manga.title.split("'").join("’"))}`;

    else
        searchUrl = 'https://mangahub.io/search?q=' + mangaName.trim();

    const html = await fethHtml(searchUrl);

    const $ = cheerio.load(html);
    let mangahub = {};

    const firstManga = $('#mangalist.row > ._1KYcM.col-sm-6.col-xs-12');

    if (!firstManga.html()) return null;

    if (!firstManga)
        return null;

    const mangaBody = firstManga
        .first()
        .find('div.media-body');

    if (!manga ) {

        mangahub.mangaHubHome = mangaBody
            .find('.media-heading > a')
            .attr('href')

        mangahub.title = mangaBody
            .find('.media-heading > a')
            .text()

        mangahub.author = mangaBody
            .find('small')
            .text().split('by')[1];

        mangahub.image = firstManga
            .first()
            .find('div.media-left > a > img')
            .attr('src');

        mangahub.latestChapter = mangaBody
            .find('p')
            .first()
            .find('a')
            .contents().text().split('#')[1];

        mangahub.mangaHubLatestUrl = mangaBody
            .find('p > a')
            .first()
            .attr('href');

        const tag = [];
        mangaBody
            .find('p')
            .next()
            .find('a')
            .each((i, e) => {
                tag.push($(e).text());
            });
        if (typeof mangahub.tags !== "undefined" && mangahub.tags.length)
            mangahub.tags = tag;


    }

    else {

        const latest = mangaBody
            .find('p')
            .first()
            .find('a')
            .contents().text().split('#')[1];

        mangahub.mangaHubLatestUrl = mangaBody
            .find('p > a')
            .first()
            .attr('href');

        if (!manga.tags.length) {

            const tag = [];
            mangaBody
                .find('p')
                .next()
                .find('a')
                .each((i, e) => {
                    tag.push($(e).text());
                });
            if (typeof mangahub.tags !== "undefined" && mangahub.tags.length)
                mangahub.tags = tag;
        }

        if (!manga.latestChapter) {

            mangahub.latestChapter = mangaBody
                .find('p')
                .first()
                .find('a')
                .contents().text().split('#')[1];

        }

        else if (parseFloat(manga.latestChapter) < parseFloat(latest)) {
            manga.latestChapter = latest;
            manga.mangaDexLatestUrl = null;
        }

    }

    if (mangahub.mangaHubLatestUrl === mangahub.mangaHubHome) {
        const temp = mangahub.link + '/chapter-' +mangahub.latestChapter;
        mangahub.mangaHubLatestUrl = temp.replace('/manga/', '/chapter/');

    }

    return mangahub;
}

async function scrapMangaNelo(mangaName, manga) {

    let tempName;
    if(manga)
        tempName = manga.title + '';
    else
        tempName = mangaName + '';

    let nameEdited = tempName.trim().split(" ").join("_").replace(/[^a-z0-9, _]/ig, '');
    let searchUrl = 'https://m.manganelo.com/search/story/' + nameEdited;
    const pageHtml = await fethHtml(searchUrl);
    const $ = cheerio.load(pageHtml);
    const firstManga = $('.panel-search-story').find('.search-story-item').first();
    if (!firstManga.html()) return null;
    let mangaNelo = {};

    if (!manga) {

        const rating = firstManga
            .find('a.item-img')
            .find('em.item-rate')
            .text();

        const views = firstManga
            .find('.item-right')
            .find('span.text-nowrap.item-time')
            .first().next().text().split('View : ').join('').trim();
    }

    mangaNelo.mangaNeloLink = firstManga
        .find('.item-right')
        .find('a.item-chapter.a-h.text-nowrap')
        .first()
        .attr('href');

    return mangaNelo;
}

async function getFirstManga(id, language = 'gb') {

    if (!id ) return null;

    let manga = {};
    const url = `https://api.mangadex.org/v2/manga/${id}/?include=chapters`;
    const session = await axios.get(url);
    const mangaData = session['data']['data']['manga'];
    const chapters = session['data']['data']['chapters'];

    manga = {
        id : mangaData.id,
        title : mangaData.title,
        author : mangaData.author,
        tags : [],
        mangadexHome : `https://mangadex.org/title/${mangaData.id}`,
        rating : mangaData.rating.bayesian,
        views : mangaData.views,
        image : mangaData.mainCover.replace('.jpeg','.large.jpg'),
        country : mangaData.publication.language
    };

    for (let el in mangaData.tags) {
        if (labels[mangaData.tags[el]]) {
            manga.tags.push(labels[mangaData.tags[el]]);
        }
    }

    for (let i in chapters) {

        if (chapters[i].language === language) {
            manga.latestChapter = chapters[i].chapter;
            manga.mangaDexLatestUrl = `https://mangadex.org/chapter/${chapters[i].id}`;
            break;
        }
    }

    return manga;
}

async function getMangaList(mangaName) {

    let mangaList = [];

    const pageHtml = await mangadex.search(mangaName);
    const $ = cheerio.load(pageHtml);
    $('.row.mt-1.mx-0').children().each((i, el) => {

        mangaList.push($(el).attr('data-id'));
    });

    return mangaList;
}

function verifMangaAttr(manga) {

    if (!manga.views)
        manga.views = 'no data';

    if (typeof manga.tags !== "undefined" && manga.tags.length) {

        if (manga.tags.length > 4)
            manga.tags = manga.tags.slice(0, 4);

        manga.tags = manga.tags.join(', ')
    }
    else
        manga.tags = 'no tags';

    if (!manga.rating)
        manga.rating = 'no data';

    if (!manga.author)
        manga.author = 'no data';

    if (manga.country)
        manga.flag = `:flag_${manga.country}:`;
    else
        manga.flag = '';

    if (!manga.latestChapter) {
        manga.latestChapter = '??';
    }

    manga.hyperLink = [];

    if (manga.mangaDexLatestUrl)
        manga.hyperLink.push(`[mangaDex](${manga.mangaDexLatestUrl})`);
    if (manga.mangaHubLatestUrl)
        manga.hyperLink.push(`[mangaHub](${manga.mangaHubLatestUrl})`);
    if(manga.mangaNeloLink)
        manga.hyperLink.push(`[mangaNelo](${manga.mangaNeloLink})`);

    if (!manga.hyperLink.length)
        manga.hyperLink = 'no link';
    else
        manga.hyperLink = manga.hyperLink.join(' - ');


    if (!manga.mangadexHome){
        manga.titleUrl = manga.mangaHubHome;
        manga.authUrl = 'https://i.imgur.com/PGN53oM.png';
    }
    else {
        manga.titleUrl = manga.mangadexHome;
        manga.authUrl = 'https://i.imgur.com/nA5ovWa.png';
    }

    if (!manga.status) {
        manga.status = 'Ongoing'
    }

}

async function getManga(mangaName, mangaList, counter) {

    let id;
    let mangadex = {}
    let manga = {}

    if (mangaList && mangaList.length > 0 && mangaList[counter]) {
        id = mangaList[counter];
    }
    else {
        mangaList = await getMangaList(mangaName);
        id = mangaList[counter];
    }

    mangadex = await getFirstManga(id);
    mangadex.mangaList = mangaList;

    /*let mangadex = await scrapMangaDex(mangaName, mangaList, counter);
    const manganelo = await scrapMangaNelo(mangaName, mangadex);
    let manga = {};*/

    const mangahub = await scrapMangaHub(mangaName, mangadex);
    manga = Collect(manga, mangadex, mangahub);

    verifMangaAttr(manga);

    return manga;
}

module.exports = {
    scrapWebnovel,
    scrapWuxiaWorld,
    verifMangaAttr,
    getManga
}