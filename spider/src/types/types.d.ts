// declare student's info, contains grades
declare interface StudentInfo {
    name: string,
    avatar: string,
    repo_url: string,
    grades: any,
    lastUpdateAt: number
}

// declare config of the file
interface ResultObject {
    available: any;
    students: Array<StudentInfo>;
    latestUpdatedAt: number
}