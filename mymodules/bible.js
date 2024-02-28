//credit to git:thiagobodruk for the Bible JSON

var fs = require('fs');
const books = [18,19,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65]
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}
class MyClass  {
    constructor(){
    this.data = fs.readFileSync('./mymodules/json/en-kjv.json','utf-8');

    }
    greet() {
        //need book 18, psalms
        
        this.randbook = JSON.parse(this.data)[0][books[getRandomInt(0,books.length-1)]];// books.length-1)]];
        this.bookname = (JSON.stringify(this.randbook["name"])).replace(/['"]+/g, '');
        this.c = getRandomInt(0,this.randbook["chapters"].length);
        this.v = getRandomInt(0,this.randbook["chapters"][this.c].length);
        this.randverse = (JSON.stringify(this.randbook["chapters"][this.c][this.v])).replace(/['"]+/g, '');
        //return `${(JSON.stringify(this.bookname)).replace(/['"]+/g, '')} ${this.c+1}:${this.v+1}\n${(JSON.stringify(this.randverse)).replace(/['"]+/g, '')}`;
        return ({"book":this.bookname,"chapter":this.c+1,"verse":this.v+1,"text":this.randverse})
    }       
  }
  module.exports = MyClass;


  /*
  [
	{
	"abbrev" : "abbrev"
	"book" : "name"
	"chapters": 
		[
			["Verse 1", "Verse 2", "Verse 3", "..."],
			["Verse 1", "Verse 2", "Verse 3", "..."],
			["Verse 1", "Verse 2", "Verse 3", "..."]
		]
	}
]
*/