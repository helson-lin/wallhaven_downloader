declare interface RequestOptions {
    page: number;
    end: number;
}
declare interface ImageInfo {
    fullUrl: string;
    smallUrl: string;
    size: string;
}
declare type Sorting = 'hot' | 'toplist' | 'random' | 'relevance' | 'views';
declare type Atleast = '3840x2160' | '2560x1440' | '1920x1080';
declare type Order = 'desc' | 'asc';
declare type Category = '111' | '001' | '100' | '010';
declare interface HavenOptions {
    sorting?: Sorting;
    atleast?: Atleast;
    order?: Order;
    categories?: Category;
    purity?: "100";
}
declare type Dictionary = { [index: string]: string }
