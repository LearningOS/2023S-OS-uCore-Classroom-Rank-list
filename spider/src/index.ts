import { Octokit } from "octokit";
import { assignment, AUTH_TOKEN, fullOrganization, JsonData, organiztion, works } from "./config";
import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";
import { parse } from "csv-parse/sync";
import { addStudentInfo, buildEmptyGrades, updateAvailable } from "./utils";
import { writeFileSync } from 'fs';

const octokit = new Octokit({
    auth: AUTH_TOKEN
})

const grades: any = {};

// const proxyAgent = new HttpsProxyAgent('http://172.20.144.1:7890');

/**
 * Get the info of the assignment
 * @param {string} classroom The full name of the classroom. Note: It should be got in the url.
 * @param {string } assigment The assignment' name
 * @param {string} sessionToken Session token for the account that is the owner of the classroom
 * @returns The info of the assignment. It contains a list of students and their details. 
 */
async function fetchAssignments(classroom: string, assigment: string, sessionToken: string) {
    return new Promise<string>(async (resolve, reject) => {
        const url = `https://classroom.github.com/classrooms/${classroom}/assignments/${assigment}/download_grades`
        // Send a Get request
        const response = await fetch(url, {
            headers: {
            accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'if-none-match': 'W/"91c8c819008d409c96ac22f96ff4029d"',
            'sec-ch-ua': '".Not/A)Brand";v="99", "Google Chrome";v="103", "Chromium";v="103"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            cookie:
                `_github_classroom_session=${sessionToken}`
            },
            // referrerPolicy: 'strict-origin-when-cross-origin',
            // body: null,
            method: 'GET',
            // agent: proxyAgent
        })
    
        // If it get the result successfully.
        if (response.ok) {
            resolve(await response.text())
        } else {
            reject(`download fail: ${url}`)
        }
    })
}

/**
 * Decode the log file.
 * @param fileObject It's a file object obtained by the function getRepoLogFile.
 * @returns The value of the file.
 */
function decodeLogFile(fileObject: any) {
    let data = fileObject.data['content' as keyof typeof fileObject.data];
    let encoding = fileObject.data['encoding' as keyof typeof fileObject.data];
    let buff = Buffer.from(data, encoding);
    return buff.toString('utf8'); 
}

/**
 * Get the log file object in the repository.
 * @description By default, gh-pages branch is used, and only files in the root directory can be got.
 * @param reponame The name of the student's assignment repo.
 * @param filename The file's name in the student repository.
 * @returns The file object contains the file info and more details
 */
async function getRepoLogFile(reponame: string, filename: string) {
    try {
        return await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
            owner: organiztion,
            repo: `${reponame}`,
            path: filename,
            ref: 'gh-pages'
        });
        
    } catch (error) {
        return undefined;
    }
}

/**
 * Get the usage of the api
 * @function getApiRemaining
 */
async function getApiRemaining() {
    let response = await octokit.request('GET /rate_limit', {})
    console.log('') // print a blank line
    console.log("API详情 " + JSON.stringify(response.data.rate));
}

/**
 * Get the grade of works and combine them.
 * @param reponame The name of the student's assignment repo.
 * @param latest The value of the latest.json. It should be a json string.
 * @returns Json object contains work and its points.
 */
async function getWorksGrade(reponame: string, latest: any) {
    let grade = buildEmptyGrades();
    if(!latest) {
        console.log(`${reponame.padEnd(25)} 没有找到latest.json文件   没有分数`);
        return grade;
    }

    let file = JSON.parse(decodeLogFile(latest));
    for(let work of works) {
        // If it not has the log file, then continue.
        if(!file[work]) continue;

        // Get the value of the work's log file.
        let logFile = await getRepoLogFile(reponame, file[work]);
        let gradeFile = decodeLogFile(logFile);

        // Handle the result
        let index = gradeFile.lastIndexOf('Points: ');
        let pointString = gradeFile.substring(index).replace('Points: ', '');
        let points = pointString.split('/').map((item: string, _index: number)=>parseFloat(item));
        
        // use 
        points[0] = points[0] == points[1] ? 100 : 0;
        points[1] = 100;
        
        // Update available points by work name.
        updateAvailable(work, points[1]);

        // Store grade to points variable.
        if(work in grade) grade[work] = points[0];
        console.log(`${reponame.padEnd(25)} ${work.padEnd(8)} ${points}`)
    }
    return grade;
}

async function date2timestamp(latest: any) {
    let time = 0;
    try {
        let latestFile = JSON.parse(decodeLogFile(latest));
        for(let i in latestFile) {
            let times = latestFile[i].replace(".txt", "").split('_');
            const dateStr = `${times[0]}-${times[1]}-${times[2]} ${times[3]}:${times[4]}:${times[5]}`;
            const date = new Date(dateStr);
            if(time == 0 || date.getTime() < time) {
                time = date.getTime();
            }
        }
    } catch(e) {

    }
    return time;
}

async function getGrade() {
    let value = await fetchAssignments(fullOrganization, assignment, process.env['SESSION_TOKEN'] ?? "");

    let repos = parse(value, {
        columns: true, skip_empty_lines: true, trim: true
    })

    for(let repo of repos) {
        // Get the student's github username
        let githubUsername: string = repo['github_username'];
        let reponame: string = repo['student_repository_name'];

        // Get userinfo
        let userInfo = await octokit.request('GET /users/{username}', { username: githubUsername});

        // Initialize the student's grade by name
        grades[githubUsername] = {};
        
        // Get the latest grade record file
        let latest = await getRepoLogFile(reponame, 'latest.json');

        let lastUpdateAt = await date2timestamp(latest);
        console.log(lastUpdateAt);
        // Store userinfo to json data
        let studentGrades = await getWorksGrade(reponame, latest);
        let student = {
            name: userInfo['data']['login'],
            avatar: userInfo['data']['avatar_url'],
            repo_url: repo['student_repository_url'],
            grades: studentGrades,
            lastUpdateAt
        };
        addStudentInfo(student);
    }
}

getGrade().then(()=>getApiRemaining()).then(() => {
    // Save json data to file.
    writeFileSync('../web/src/data.json', JSON.stringify(JsonData))
})
