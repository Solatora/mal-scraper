import { Actor } from "apify";
import { createCheerioRouter } from "crawlee";
import { labels } from "./consts.js";

export const router = createCheerioRouter();

router.addHandler(labels.SEARCH, async ({ $, crawler }) => {
    const animeURL = $("#anime")
        .next()
        .children()
        .first()
        .find("a")
        .first()
        .attr("href");

    await crawler.addRequests([
        {
            label: labels.DETAIL,
            url: animeURL,
        },
    ]);
});

router.addHandler(labels.DETAIL, async ({ $ }) => {
    const originalTitle = $(".title-name").text();
    const engTitle = $(".title-english").text() || originalTitle;
    const jpTitle = $('span:contains("Japanese:")')
        .parent()
        .text()
        .replace("Japanese:", "")
        .trim();

    const information: Record<string, string | string[] | number> = {};
    let currentInformation = $('h2:contains("Information")').next();

    while (currentInformation.hasClass("spaceit_pad")) {
        currentInformation.find('span[style*="display: none"]').remove();
        const [key, value] = currentInformation.text().split(":");
        if (
            [
                "producers",
                "studios",
                "genres",
                "genre",
                "themes",
                "theme",
                "demographic",
            ].includes(key.trim().toLocaleLowerCase())
        ) {
            information[key.trim().toLocaleLowerCase()] = value
                .trim()
                .replace(/ {2,}/g, " ")
                .split(",")
                .map((str) => str.trim());
        } else {
            information[key.trim().toLocaleLowerCase()] = value
                .trim()
                .replace(/ {2,}/g, " ");
        }

        currentInformation = currentInformation.next();
    }
    information["genres"] ??= structuredClone(information["genre"]);
    delete information["genre"];
    information["themes"] ??= structuredClone(information["theme"]);
    delete information["theme"];

    information["episodes"] = Number(information["episodes"]);

    const statistics: Record<string, string | number> = {};
    let currentStatistic = $('h2:contains("Statistics")').next();

    while (currentStatistic.hasClass("spaceit_pad")) {
        currentStatistic.find('span[itemprop="ratingCount"]').remove();
        currentStatistic.find("sup").remove();
        const [key, value] = currentStatistic.text().split(":");

        statistics[key.trim().toLocaleLowerCase()] = Number(
            value
                .trim()
                .split("\n")[0]
                .replace(/,/g, "")
                .replace(/#/g, "")
                .replace(/\(.*\)/g, "")
                .trim()
        );

        currentStatistic = currentStatistic.next();
    }

    const characters: Array<any> = [];
    const charactersEl = $('h2:contains("Characters & Voice Actors")')
        .parent()
        .next();
    const charactersTables = charactersEl.find("table");

    for (const tableRow of charactersTables) {
        const table = $(tableRow);
        const characterInfoEl = table.find("td").next();

        const characterName = characterInfoEl.find("h3").text().trim();

        if (characterName == "") continue;

        const characterRole = characterInfoEl
            .find("small")
            .first()
            .text()
            .trim();

        const actorInfoEl = characterInfoEl.next();

        const actorName = actorInfoEl.find("a").text().trim();

        const language = actorInfoEl.find("small").text().trim();

        characters.push({
            name: characterName,
            role: characterRole,
            actor: actorName,
            language,
        });
    }

    const staff: Array<any> = [];
    const staffEl = $('h2:contains("Staff")').parent().next();
    const staffTables = staffEl.find("table");

    for (const tableRow of staffTables) {
        const table = $(tableRow);
        const staffInfoEl = table.find("td").next();

        const staffName = staffInfoEl.find("a").text().trim();

        if (staffName == "") continue;

        const staffRoles = staffInfoEl
            .find("small")
            .text()
            .trim()
            .split(",")
            .map((role) => role.trim());

        staff.push({
            name: staffName,
            roles: staffRoles,
        });
    }

    await Actor.pushData({
        originalTitle,
        engTitle,
        jpTitle,
        information,
        statistics,
        characters,
        staff,
    });
});

router.addHandler(labels.TOP_LIST, async ({ $, crawler, request }) => {
    const elList = $(".ranking-list");

    for (const currentAnimeTrRaw of elList) {
        const currentAnimeTr = $(currentAnimeTrRaw);

        const url = currentAnimeTr
            .find("h3")
            .first()
            .children()
            .first()
            .attr("href");

        if (request.userData.detailedList) {
            await crawler.addRequests([
                {
                    label: labels.DETAIL,
                    url,
                },
            ]);
        } else {
            const rank = Number(currentAnimeTr.find("span").first().text());

            const title = currentAnimeTr.find("h3").first().text();

            const information = currentAnimeTr
                .find(".information")
                .text()
                .trim()
                .split("\n")
                .map((str) => str.trim());

            const type = information[0].split(" ")[0];

            const episodes = Number(
                information[0].split(" ")[1].replace("(", "")
            );

            const aired = information[1];

            const members = Number(
                information[2].split(" ")[0].replace(/,/g, "")
            );

            const score = Number(
                currentAnimeTr.find('span[class*="text on score-label"]').text()
            );

            await Actor.pushData({
                rank,
                title,
                url,
                type,
                episodes,
                aired,
                members,
                score,
            });
        }
        request.userData.resultsCount += 1;

        if (request.userData.resultsCount >= request.userData.maxResults)
            return;
    }

    await crawler.addRequests([
        {
            label: labels.TOP_LIST,
            url: `https://myanimelist.net/topanime.php?limit=${request.userData.resultsCount}`,
            userData: request.userData,
        },
    ]);
});
