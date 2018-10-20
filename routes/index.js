const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cheerio = require("cheerio");

const db = require("../models");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

mongoose.connect(MONGODB_URI, { useNewUrlParser: true });

const router = express.Router();

async function retrieveArticles() {
    const response = await axios.get("https://www.wsj.com/");
    const $ = cheerio.load(response.data);
    const results = [];
    $("div.wsj-card").each(function (i, element) {
        const title = $(element).find("a.wsj-headline-link");
        const summary = $(element).find("p.wsj-summary span:first-child").text().trim();
        if (summary)
            results.push({
                title: $(title).text(),
                link: $(title).attr("href"),
                summary: summary
            });
    });
    await Promise.all(results.map(async (result) => {
        await db.Article.updateOne({
            link: result.link,
            summary: result.summary
        }, result, { upsert: true, setDefaultsOnInsert: true });
    }));
    return db.Article.find().sort({ createdAt: -1 });
}

router.get("/", function (req, res) {
    var page = parseInt(req.query.page) || 1;
    var numResults = parseInt(req.query.numResults) || 10;
    var startIndex = numResults * (page - 1);
    retrieveArticles().then(
        function (articles) {
            res.render("index", {
                articles: articles.slice(startIndex, numResults + startIndex),
                page: page,
                numResults: numResults,
                pageNums: [...Array(Math.ceil(
                    articles.length
                    / numResults)).keys()].map(i => 1 + i),
                helpers: {
                    selected: function (num) {
                        if (num === numResults)
                            return "selected";
                    }
                }
            });
        });
});

module.exports = router;