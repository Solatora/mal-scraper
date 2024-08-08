import { Actor, log } from "apify";
import { CheerioCrawler, Dataset } from "crawlee";
import { router } from "./routes.js";
import { labels } from "./consts.js";

interface Input {
    mode: "list" | "search";
    searchTitles?: string[];
    maxResults?: number;
    detailedList?: boolean;
}

await Actor.init();

// console.log("yippie");
const {
    mode,
    searchTitles,
    maxResults = 50,
    detailedList = false,
} = (await Actor.getInput<Input>()) ?? ({} as Input);

const proxyConfiguration = await Actor.createProxyConfiguration();

const crawler = new CheerioCrawler({
    proxyConfiguration,
    requestHandler: router,
});

if (mode == "list") {
    await crawler.addRequests([
        {
            label: labels.TOP_LIST,
            url: `https://myanimelist.net/topanime.php?limit=0`,
            userData: { maxResults, detailedList, resultsCount: 0 },
        },
    ]);
} else if (mode == "search") {
    if (!searchTitles) {
        await Actor.exit("searchTitles empty");
    }
    await crawler.addRequests(
        searchTitles!.map((title) => ({
            label: labels.SEARCH,
            url: `https://myanimelist.net/search/all?cat=all&q=${encodeURIComponent(
                title
            )}`,
        }))
    );
}

await crawler.run();

await Actor.exit();
