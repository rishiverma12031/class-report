const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data.json');
const raw = fs.readFileSync(filePath, 'utf-8');
const data = JSON.parse(raw);

validateData(data);
displayReport(data);

//Validation Functions

function validateData (classData) {
    
    if (typeof classData !== "object" || classData === null) fail("Root data must be an object");

    if (typeof classData.className !== "string" || classData.className === "") fail("Class name must be a non-empty string");

    const yearType = typeof classData.academicYear;
    if ((yearType !== "string" && yearType!== "number") || classData.className === "") fail("Academic year must be a non-empty string or a number");
    
    if (!Array.isArray(classData.subjects) || classData.subjects.length === 0) fail("Subjects must be a non-empty array");

    if (!Array.isArray(classData.students) || classData.students.length === 0) fail("Students must be a non-empty array");

    validateStudents(classData.students, classData.subjects);

}

function validateStudents (students, subjects) {

    const subjectSet = new Set(subjects);
    const studentNames = new Set();

    students.forEach((student, index) => {

        if (typeof student.name !== "string" || student.name.trim() === "") fail("Student at index " + index + " has invalid name");

        if (studentNames.has(student.name)) fail("Duplicate student name: " +  student.name);

        studentNames.add(student.name);

        if (typeof student.marks !== "object" || student.marks === null) fail("Marks missing for student: " + student.name);

        validateMarks(student.name, student.marks, subjectSet);

    });

}

function validateMarks(studentName, marks, subjectSet) {

    const markSubjects = Object.keys(marks);

    //Missing subjects
    subjectSet.forEach(subject => {

        if (!(subject in marks)) fail("Missing marks for subject " + subject + " for student " + studentName);

    });

    //Extra subjects
    markSubjects.forEach(subject => {

        if (!subjectSet.has(subject)) fail("Unknown subject " + subject + " in marks of student " + studentName);

        const mark = marks[subject];
        
        if (typeof mark !== "number" || mark < 0 || mark > 100) fail("Invalid marks for " + studentName + " in subject " + subject + " : " + mark);

    });

}

function fail (message) {

    console.error("Invalid data: ", message);
    process.exit(1);

}

//Utility Functions

function getClassMetadata (classData) {

    return {
        className: classData.className,
        academicYear: classData.academicYear,
        totalNumOfStudents: classData.students.length,
        totalNumOfSubjects: classData.subjects.length
    };

}

function getStudentReport (studentData) {

    const studentReportWithoutRank = getStudentReportWithoutRank(studentData);
    const sortedStudentReport = sortStudentReport(studentReportWithoutRank);
    const rankedStudentReport = rankStudentReport(sortedStudentReport);
    
    return rankedStudentReport;

}

function getStudentReportWithoutRank (studentData) {

    return studentData.map(student => {

        const studentName = student.name;
        const allMarks = Object.values(student.marks);
        const totalMarks = allMarks.reduce((acc, cur) => acc + cur, 0);
        const avgMarks = totalMarks / allMarks.length;
        const result = allMarks.every(mark => mark >= 40) ? "Pass" : "Fail" ;
            
        return {studentName, totalMarks, avgMarks, result};

    });

}

function sortStudentReport (unsortedReport) {

    return [...unsortedReport].sort((a, b) => a.totalMarks === b.totalMarks ? b.avgMarks - a.avgMarks : b.totalMarks - a.totalMarks);

}

function rankStudentReport (unrankedReport) {

    return unrankedReport.map((student, index) => {

        if (index === 0) return {...student, rank: 1};
        
        else
        return (student.totalMarks === unrankedReport[index - 1].totalMarks && student.avgMarks === unrankedReport[index - 1].avgMarks) ?
        {...student, rank: unrankedReport[index - 1].rank} : 
        {...student, rank: index + 1};

    });

}

function getSubjectReport (studentData) {

    const reportPerSubject = getReportPerSubject(studentData);

    const subjectReport = Object.entries(reportPerSubject).map(subject => ({
        subjectName : subject[0],
        avgMarks : subject[1].total / studentData.length,
        highestMarks : subject[1].max,
        highestScorer : subject[1].maxScorer,
        lowestMarks : subject[1].min,
        lowestScorer : subject[1].minScorer,
        passStudents : studentData.length - subject[1].failStudents,
        failStudents : subject[1].failStudents
    }));

    return subjectReport;

}

function getReportPerSubject (studentData) {

    const reportPerSubject = {};

    studentData.forEach(student => {

        for(let subject in student.marks) {

            const curStudentMarks = student.marks[subject];
            
            reportPerSubject[subject] ? 
            updateSubjectValues(student, reportPerSubject, subject, curStudentMarks) : 
            initialiseSubjectValues(student, reportPerSubject, subject, curStudentMarks);
            
        };

    });

    return reportPerSubject;

}

function updateSubjectValues(student, reportPerSubject, subject, curStudentMarks) {

    reportPerSubject[subject].total += curStudentMarks;

    if (reportPerSubject[subject].max < curStudentMarks) {

        reportPerSubject[subject].max = curStudentMarks;
        reportPerSubject[subject].maxScorer = student.name;
    
    };

    if (reportPerSubject[subject].min > curStudentMarks) {

        reportPerSubject[subject].min = curStudentMarks;
        reportPerSubject[subject].minScorer = student.name;
    
    };

    if (curStudentMarks < 40) reportPerSubject[subject].failStudents++;

}

function initialiseSubjectValues(student, reportPerSubject, subject, curStudentMarks) {
    
    reportPerSubject[subject] = {
        total : curStudentMarks,
        max : curStudentMarks,
        maxScorer : student.name,
        min : curStudentMarks,
        minScorer : student.name,
        failStudents : 0 
    };

}

function getFinalSummary (studentReport) {

    const classAvg = studentReport.reduce((classTotal, student) => classTotal += student.totalMarks, 0) / studentReport.length;

    const topStudent = studentReport.reduce((previousStudent, curStudent) => previousStudent.totalMarks < curStudent.totalMarks ? curStudent : previousStudent).studentName;

    const bottomStudent = studentReport.reduce((previousStudent, curStudent) => previousStudent.totalMarks > curStudent.totalMarks ? curStudent : previousStudent).studentName;

    const passPercentage = studentReport.filter(student => student.result === "Pass").length / studentReport.length * 100; 

    return {classAvg, topStudent, bottomStudent, passPercentage};

}

// Display Functions

function displayReport (classData) {

    const classMetadata = getClassMetadata(classData);
    const studentReport = getStudentReport(classData.students);
    const subjectReport = getSubjectReport(classData.students);
    const finalSummary = getFinalSummary(studentReport);

    displayClassMetadata(classMetadata);
    displayStudentReport(studentReport);
    displaySubjectReport(subjectReport);
    displayFinalSummary(finalSummary);
    
}

function displayClassMetadata (metadata) {

    console.log(
        "\n|CLASS METADATA|\n",
        "\n Class name: " + metadata.className,
        "\n Academic year: " + metadata.academicYear,
        "\n Total number of students: " + metadata.totalNumOfStudents,
        "\n Total number of subjects: " + metadata.totalNumOfSubjects,
    );

}

function displayStudentReport (studentReport) {

    console.log("\n|STUDENT REPORT|");

    studentReport.forEach( student => {

        console.log(
            "\n Name: " + student.studentName,
            "\n Total marks: " + student.totalMarks,
            "\n Average marks: " + student.avgMarks,
            "\n Result: " + student.result,
            "\n Rank: " + student.rank,
        );

    });

}

function displaySubjectReport (subjectReport) {

    console.log("\n|SUBJECT REPORT|");

    subjectReport.forEach( subject => {

        console.log(
            "\n Subject: " + subject.subjectName,
            "\n Average marks: " + subject.avgMarks,
            "\n Highest marks: " + subject.highestMarks +"(" + subject.highestScorer +")",
            "\n Lowest marks: " + subject.lowestMarks +"(" + subject.lowestScorer +")",
            "\n No. of students passed: " + subject.passStudents,
            "\n No. of students failed: " + subject.failStudents
        );

    });

}

function displayFinalSummary (summary) {

    console.log("\n |FINAL SUMMARY|\n",
        "\n Class average: " + summary.classAvg,
        "\n Top performing student: " + summary.topStudent,
        "\n Bottom performing student: " + summary.bottomStudent,
        "\n Overall pass percentage: " + summary.passPercentage
    );

}