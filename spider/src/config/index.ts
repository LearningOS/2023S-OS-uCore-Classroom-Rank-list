import * as dotenv from "dotenv";

export const config = dotenv.config();

export const organiztion: string = 'LearningOS';            // 组织
export const fullOrganization: string = '19380377-2023s-os-rcore-classroom'; // classroom名称
export const assignment = '2023S-rCore';   // assignment
export const works = ['ch3','ch4','ch5','ch6','ch8']; // assignment 的不同情况
export const AUTH_TOKEN = process.env['TOKEN'];

// JsonData store the grades and the other info.
export let JsonData: ResultObject = {
    available: {},
    // grades has the tree. grades --> studentGithubUsername --> workName --> grade
    students: [],
    // latest update time
    latestUpdatedAt: Date.now()
}


// initialize the JsonData by works
for(let work of works) {
    JsonData['available'][work] = 0;
} 
