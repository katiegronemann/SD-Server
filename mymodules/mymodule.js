class MyClass  {
    constructor(arg){
        this.uname = arg;
    }
    greet() {
        return `Hello ${this.uname}!`;
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